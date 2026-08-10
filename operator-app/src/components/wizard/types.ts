export type DeviceType = "gateway-mock" | "gateway-real" | "node-mock" | "node-real";

export const isGateway = (dt: DeviceType) =>
  dt === "gateway-mock" || dt === "gateway-real";

export const FIRMWARE_ASSET: Record<DeviceType, string> = {
  "gateway-mock": "gateway-node-mock.bin",
  "gateway-real": "gateway-node-real.bin",
  "node-mock":    "sensor-node-mock.bin",
  "node-real":    "sensor-node-real.bin",
};

export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  port: string | null;
  wifiSsid: string;
  wifiPass: string;
  chirpstackHost: string;
  devEui: string;
  appEui: string;
  appKey: string;
  firmwarePath: string;
  gatewayEui: string;
}

export interface AssetStatus {
  name: string;
  download_url: string;
  sha256_url: string | null;
  size: number;
  cached_path: string | null;
}

export interface FirmwareStatus {
  latest_tag: string;
  cached_tag: string | null;
  needs_update: boolean;
  bin_assets: AssetStatus[];
  offline: boolean;
}

export type FirmwareCheck =
  | { state: "loading" }
  | { state: "ready"; status: FirmwareStatus }
  | { state: "error"; msg: string };

export const INITIAL_STATE: WizardState = {
  step: 1,
  port: null,
  wifiSsid: "",
  wifiPass: "",
  chirpstackHost: "",
  devEui: "",
  appEui: "0000000000000000",
  appKey: "",
  firmwarePath: "",
  gatewayEui: "",
};
