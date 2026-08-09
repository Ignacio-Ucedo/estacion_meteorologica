import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import SettingsPanel from "./components/SettingsPanel";
import FlashWizard from "./components/wizard/FlashWizard";
import { getBackendUrl } from "./api/backend";
import "./App.css";

export type Section =
  | "gateway"
  | "users"
  | "settings"
  | "flash-gateway-mock"
  | "flash-gateway-real"
  | "flash-node-mock"
  | "flash-node-real";

function App() {
  const [activeSection, setActiveSection] = useState<Section>("gateway");
  const [backendUrl, setBackendUrl] = useState<string>(getBackendUrl);
  const [otaaKeys, setOtaaKeys] = useState({ devEui: "", appKey: "" });

  const renderPanel = () => {
    switch (activeSection) {
      case "gateway":    return <VirtualGatewayPanel onConfigLoaded={(devEui, appKey) => setOtaaKeys({ devEui, appKey })} />;
      case "users":      return <UserManagementPanel />;
      case "settings":   return <SettingsPanel onUrlChange={setBackendUrl} devEui={otaaKeys.devEui} appKey={otaaKeys.appKey} />;
      case "flash-gateway-mock":
        return <FlashWizard title="Flash Gateway Mock" />;
      case "flash-gateway-real":
        return <FlashWizard title="Flash Gateway Real" />;
      case "flash-node-mock":
        return <FlashWizard title="Flash Node Mock" />;
      case "flash-node-real":
        return <FlashWizard title="Flash Node Real" />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} backendUrl={backendUrl} />
      <main className="main-panel">
        {renderPanel()}
      </main>
    </div>
  );
}

export default App;
