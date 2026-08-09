export interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  port: string | null;
  wifiSsid: string;
  wifiPass: string;
  chirpstackHost: string;
  devEui: string;
  appEui: string;
  appKey: string;
}

export const INITIAL_STATE: WizardState = {
  step: 1,
  port: null,
  wifiSsid: "",
  wifiPass: "",
  chirpstackHost: "",
  devEui: "",
  appEui: "0000000000000000",
  appKey: "",
};
