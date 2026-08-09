import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WizardState } from "./types";

interface KeyEntry {
  dev_eui: string;
  app_key: string;
  assigned: boolean;
  assigned_at: string | null;
}

interface Props {
  state: WizardState;
  onUpdate: (u: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

interface WifiSuggestions {
  connected: string | null;
  available: string[];
}

export default function WizardStep2_Config({ state, onUpdate, onBack, onNext }: Props) {
  const [keyError, setKeyError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(false);
  const [detectedSsid, setDetectedSsid] = useState<string | null>(null);
  const [availableSsids, setAvailableSsids] = useState<string[]>([]);

  useEffect(() => {
    if (state.devEui || state.appKey) return;
    setLoadingKey(true);
    invoke<KeyEntry>("next_available_key")
      .then((entry) => {
        onUpdate({ devEui: entry.dev_eui, appKey: entry.app_key });
        setKeyError(null);
      })
      .catch((err: string) => setKeyError(err))
      .finally(() => setLoadingKey(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    invoke<WifiSuggestions>("get_wifi_suggestions")
      .then(({ connected, available }) => {
        setAvailableSsids(available);
        if (!state.wifiSsid && connected) {
          setDetectedSsid(connected);
          onUpdate({ wifiSsid: connected });
        }
      })
      .catch(() => { /* ignorar si no se puede detectar */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valid =
    state.wifiSsid.trim().length > 0 &&
    state.wifiPass.trim().length > 0 &&
    state.chirpstackHost.trim().length > 0 &&
    state.devEui.length === 16 &&
    state.appKey.length === 32;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 480 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Configuración del nodo
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Puerto seleccionado:{" "}
          <code style={{ color: "#60a5fa", fontFamily: "monospace" }}>{state.port}</code>
        </p>
      </div>

      {/* Credenciales WiFi */}
      <fieldset style={{ border: "1px solid #2d3148", borderRadius: 8, padding: "16px 16px 12px" }}>
        <legend style={{ fontSize: 12, color: "#64748b", padding: "0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          WiFi del gateway
        </legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="field-row">
              <label className="field-label">SSID</label>
              <input
                className="field-input"
                type="text"
                list="wifi-ssid-list"
                placeholder="nombre de la red WiFi"
                value={state.wifiSsid}
                onChange={(e) => {
                  if (e.target.value !== detectedSsid) setDetectedSsid(null);
                  onUpdate({ wifiSsid: e.target.value });
                }}
              />
              {availableSsids.length > 0 && (
                <datalist id="wifi-ssid-list">
                  {availableSsids.map((ssid) => (
                    <option key={ssid} value={ssid} />
                  ))}
                </datalist>
              )}
            </div>
            {detectedSsid && state.wifiSsid === detectedSsid && (
              <p style={{ fontSize: 11, color: "#60a5fa", margin: "0 0 0 90px" }}>
                Red WiFi detectada — podés cambiarla si el gateway usa otra
              </p>
            )}
          </div>
          <div className="field-row">
            <label className="field-label">Contraseña</label>
            <input
              className="field-input"
              type="password"
              placeholder="contraseña WiFi"
              value={state.wifiPass}
              onChange={(e) => onUpdate({ wifiPass: e.target.value })}
            />
          </div>
        </div>
      </fieldset>

      {/* ChirpStack */}
      <fieldset style={{ border: "1px solid #2d3148", borderRadius: 8, padding: "16px 16px 12px" }}>
        <legend style={{ fontSize: 12, color: "#64748b", padding: "0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ChirpStack
        </legend>
        <div className="field-row">
          <label className="field-label">Host / IP del servidor</label>
          <input
            className="field-input"
            type="text"
            placeholder="192.168.1.100"
            value={state.chirpstackHost}
            onChange={(e) => onUpdate({ chirpstackHost: e.target.value })}
          />
        </div>
      </fieldset>

      {/* OTAA Keys (solo lectura) */}
      <fieldset style={{ border: "1px solid #2d3148", borderRadius: 8, padding: "16px 16px 12px" }}>
        <legend style={{ fontSize: 12, color: "#64748b", padding: "0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Claves OTAA
        </legend>
        {loadingKey ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Asignando claves OTAA…</p>
        ) : keyError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, color: "#f87171" }}>
              Error al obtener claves: {keyError}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field-row">
              <label className="field-label">DevEUI</label>
              <input
                className="field-input"
                type="text"
                value={state.devEui}
                readOnly
                style={{ opacity: 0.7, cursor: "default", fontFamily: "monospace" }}
              />
            </div>
            <div className="field-row">
              <label className="field-label">AppKey</label>
              <input
                className="field-input"
                type="text"
                value={state.appKey}
                readOnly
                style={{ opacity: 0.7, cursor: "default", fontFamily: "monospace", fontSize: 11 }}
              />
            </div>
          </div>
        )}
      </fieldset>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Atrás
        </button>
        <button
          className="btn btn-primary"
          disabled={!valid}
          onClick={onNext}
        >
          Iniciar flash →
        </button>
      </div>
    </div>
  );
}
