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
