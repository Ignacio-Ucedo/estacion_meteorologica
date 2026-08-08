#!/usr/bin/env python3
"""
Provisiona ChirpStack para el gateway-node-mock.
Lee las claves OTAA desde firmware/nvs_mock.csv.
Al terminar escribe infra/.env con el CHIRPSTACK_APP_ID y reinicia el backend.

Uso:
    python3 infra/chirpstack-provision.py [--gateway-eui AABBCCFFFEDDEEFF]
"""
import argparse
import csv
import os
import subprocess
import sys
from pathlib import Path

import grpc
from chirpstack_api import api
from chirpstack_api.common import common_pb2 as common

CHIRPSTACK_HOST = "localhost:8080"
API_TOKEN = None  # se obtiene del subcomando create-api-key o se pasa como arg
TENANT_ID = "63c516df-3b80-4d82-a7f9-e9d505e36851"

REPO_ROOT = Path(__file__).parent.parent
NVS_CSV = REPO_ROOT / "firmware" / "nvs_mock.csv"
ENV_FILE = REPO_ROOT / "infra" / ".env"


def read_nvs_csv(path: Path) -> dict:
    """Lee DevEUI, AppEUI y AppKey del CSV de NVS."""
    keys = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            if row["type"] == "data":
                keys[row["key"]] = row["value"].strip()
    return keys


def get_or_create_token() -> str:
    """Crea una API key temporal via CLI de ChirpStack."""
    print("Creando API key en ChirpStack…")
    result = subprocess.run(
        ["docker", "compose", "-f", str(REPO_ROOT / "infra" / "docker-compose.yml"),
         "exec", "chirpstack", "chirpstack", "--config", "/etc/chirpstack",
         "create-api-key", "--name", "provisioning-script"],
        capture_output=True, text=True
    )
    for line in result.stdout.splitlines():
        if line.startswith("token:"):
            return line.split(":", 1)[1].strip()
    raise RuntimeError(f"No se pudo obtener token:\n{result.stdout}\n{result.stderr}")


def provision(gateway_eui: str, token: str, backend_url: str):
    auth = [("authorization", f"Bearer {token}")]
    channel = grpc.insecure_channel(CHIRPSTACK_HOST)

    # ── 1. Leer NVS CSV ──────────────────────────────────────────────────────
    if not NVS_CSV.exists():
        print(f"ERROR: No se encontró {NVS_CSV}")
        print("Creá firmware/nvs_mock.csv con dev_eui, app_eui, app_key.")
        sys.exit(1)

    nvs = read_nvs_csv(NVS_CSV)
    dev_eui = nvs.get("dev_eui", "").lower()
    app_eui = nvs.get("app_eui", "0000000000000000").lower()
    app_key = nvs.get("app_key", "").lower()

    if not dev_eui or not app_key:
        print(f"ERROR: nvs_mock.csv debe tener dev_eui y app_key. Encontrado: {nvs}")
        sys.exit(1)

    print(f"  DevEUI : {dev_eui}")
    print(f"  AppKey : {app_key[:8]}…")

    # ── 2. Registrar Gateway (opcional) ──────────────────────────────────────
    if gateway_eui:
        gw_client = api.GatewayServiceStub(channel)
        gw_eui_lower = gateway_eui.lower()
        try:
            gw_client.Get(api.GetGatewayRequest(gateway_id=gw_eui_lower), metadata=auth)
            print(f"Gateway {gw_eui_lower} ya existe — OK")
        except grpc.RpcError as e:
            if e.code() != grpc.StatusCode.NOT_FOUND:
                raise
            gw = api.Gateway(
                gateway_id=gw_eui_lower,
                name="esp32-gateway-node-mock",
                tenant_id=TENANT_ID,
            )
            gw_client.Create(api.CreateGatewayRequest(gateway=gw), metadata=auth)
            print(f"Gateway {gw_eui_lower} creado")
    else:
        print("Gateway EUI no provisto — omitiendo registro del gateway.")

    # ── 3. Device Profile ─────────────────────────────────────────────────────
    dp_client = api.DeviceProfileServiceStub(channel)
    dp_list = dp_client.List(
        api.ListDeviceProfilesRequest(limit=20, tenant_id=TENANT_ID), metadata=auth
    )
    dp_id = None
    for dp in dp_list.result:
        if dp.name == "esp32-sensor-au915":
            if dp.region == common.Region.AU915:
                dp_id = dp.id
                print(f"Device profile '{dp.name}' ya existe (AU915) — OK")
            else:
                print(f"Device profile '{dp.name}' tiene region incorrecta ({dp.region}), eliminando para recrear...")
                dp_client.Delete(api.DeleteDeviceProfileRequest(id=dp.id), metadata=auth)
            break

    if dp_id is None:
        dp = api.DeviceProfile(
            name="esp32-sensor-au915",
            tenant_id=TENANT_ID,
            region=common.Region.AU915,
            mac_version=common.MacVersion.LORAWAN_1_0_2,
            reg_params_revision=common.RegParamsRevision.B,
            supports_otaa=True,
            uplink_interval=600,
        )
        resp = dp_client.Create(api.CreateDeviceProfileRequest(device_profile=dp), metadata=auth)
        dp_id = resp.id
        print(f"Device profile 'esp32-sensor-au915' creado: {dp_id}")

    # ── 4. Application ────────────────────────────────────────────────────────
    app_client = api.ApplicationServiceStub(channel)
    app_list = app_client.List(
        api.ListApplicationsRequest(limit=20, tenant_id=TENANT_ID), metadata=auth
    )
    app_id = None
    for a in app_list.result:
        if a.name == "weather-station":
            app_id = a.id
            print(f"Application 'weather-station' ya existe: {app_id}")
            break

    if app_id is None:
        app = api.Application(name="weather-station", tenant_id=TENANT_ID)
        resp = app_client.Create(api.CreateApplicationRequest(application=app), metadata=auth)
        app_id = resp.id
        print(f"Application 'weather-station' creada: {app_id}")

    # ── 5. HTTP Integration ───────────────────────────────────────────────────
    webhook_url = f"{backend_url.rstrip('/')}/integrations/chirpstack/uplink"
    try:
        app_client.GetHttpIntegration(
            api.GetHttpIntegrationRequest(application_id=app_id), metadata=auth
        )
        app_client.UpdateHttpIntegration(
            api.UpdateHttpIntegrationRequest(
                integration=api.HttpIntegration(
                    application_id=app_id,
                    event_endpoint_url=webhook_url,
                )
            ),
            metadata=auth,
        )
        print(f"HTTP integration actualizada → {webhook_url}")
    except grpc.RpcError as e:
        if e.code() != grpc.StatusCode.NOT_FOUND:
            raise
        app_client.CreateHttpIntegration(
            api.CreateHttpIntegrationRequest(
                integration=api.HttpIntegration(
                    application_id=app_id,
                    event_endpoint_url=webhook_url,
                )
            ),
            metadata=auth,
        )
        print(f"HTTP integration creada → {webhook_url}")

    # ── 6. Device ─────────────────────────────────────────────────────────────
    dev_client = api.DeviceServiceStub(channel)
    try:
        resp = dev_client.Get(api.GetDeviceRequest(dev_eui=dev_eui), metadata=auth)
        existing = resp.device
        if existing.device_profile_id != dp_id:
            print(f"Device {dev_eui} tiene device_profile_id incorrecto, actualizando a AU915...")
            existing.device_profile_id = dp_id
            dev_client.Update(api.UpdateDeviceRequest(device=existing), metadata=auth)
            print(f"Device {dev_eui} actualizado al profile AU915")
        else:
            print(f"Device {dev_eui} ya existe con profile AU915 — OK")
    except grpc.RpcError as e:
        if e.code() != grpc.StatusCode.NOT_FOUND:
            raise
        dev = api.Device(
            dev_eui=dev_eui,
            name="gateway-node-mock",
            application_id=app_id,
            device_profile_id=dp_id,
        )
        dev_client.Create(api.CreateDeviceRequest(device=dev), metadata=auth)
        print(f"Device {dev_eui} creado")

    # ── 7. OTAA Keys ──────────────────────────────────────────────────────────
    device_keys = api.DeviceKeys(dev_eui=dev_eui, nwk_key=app_key, app_key=app_key)
    try:
        dev_client.UpdateKeys(
            api.UpdateDeviceKeysRequest(device_keys=device_keys), metadata=auth
        )
    except grpc.RpcError as e:
        if e.code() != grpc.StatusCode.NOT_FOUND:
            raise
        dev_client.CreateKeys(
            api.CreateDeviceKeysRequest(device_keys=device_keys), metadata=auth
        )
    print(f"AppKey configurada para {dev_eui}")

    # ── 8. Actualizar infra/.env ───────────────────────────────────────────────
    env_content = f"CHIRPSTACK_APP_ID={app_id}\n"
    ENV_FILE.write_text(env_content)
    print(f"\ninfra/.env actualizado: CHIRPSTACK_APP_ID={app_id}")

    print("\n✓ Provisioning completo. Reiniciando backend…")
    subprocess.run(
        ["docker", "compose", "-f", str(REPO_ROOT / "infra" / "docker-compose.yml"),
         "up", "-d", "backend"],
        check=True
    )
    print("Backend reiniciado. Stack listo.")


def main():
    parser = argparse.ArgumentParser(description="Provisionar ChirpStack para gateway-node-mock")
    parser.add_argument(
        "--gateway-eui",
        default=None,
        help="EUI-64 del gateway (16 hex chars, ej: aabbccfffeddeeff). "
             "Opcional: si no se pasa, se omite el registro del gateway.",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="JWT token de ChirpStack (si no se pasa, se genera uno automáticamente)",
    )
    parser.add_argument(
        "--backend-url",
        default="https://estacion-meteorologica-nnsz.onrender.com",
        help="URL base del backend para la integración HTTP de ChirpStack "
             "(default: Render producción). Usar http://localhost:8000 para desarrollo local.",
    )
    args = parser.parse_args()

    token = args.token or get_or_create_token()
    provision(args.gateway_eui, token, args.backend_url)


if __name__ == "__main__":
    main()
