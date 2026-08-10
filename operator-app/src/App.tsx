import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import SettingsPanel from "./components/SettingsPanel";
import HistoryPanel from "./components/HistoryPanel";
import FlashWizard from "./components/wizard/FlashWizard";
import { getBackendUrl } from "./api/backend";
import "./App.css";

export type Section =
  | "gateway"
  | "users"
  | "history"
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
      case "history":    return <HistoryPanel />;
      case "settings":   return <SettingsPanel onUrlChange={setBackendUrl} devEui={otaaKeys.devEui} appKey={otaaKeys.appKey} />;
      case "flash-gateway-mock":
        return <FlashWizard title="Flash Gateway Mock" deviceType="gateway-mock" />;
      case "flash-gateway-real":
        return <FlashWizard title="Flash Gateway Real" deviceType="gateway-real" />;
      case "flash-node-mock":
        return <FlashWizard title="Flash Node Mock" deviceType="node-mock" />;
      case "flash-node-real":
        return <FlashWizard title="Flash Node Real" deviceType="node-real" />;
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
