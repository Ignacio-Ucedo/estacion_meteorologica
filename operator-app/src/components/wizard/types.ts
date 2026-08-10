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
  devEui: string;
  appEui: string;
  appKey: string;
  firmwarePath: string;
}

export const INITIAL_STATE: WizardState = {
  step: 1,
  port: null,
  wifiSsid: "",
  wifiPass: "",
  devEui: "",
  appEui: "0000000000000000",
  appKey: "",
  firmwarePath: "",
};
