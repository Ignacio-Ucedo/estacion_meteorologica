import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import SettingsPanel from "./components/SettingsPanel";
import HistoryPanel from "./components/HistoryPanel";
import FlashWizard from "./components/wizard/FlashWizard";
import CustomerSelect from "./components/CustomerSelect";
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

const FLASH_SECTIONS: Section[] = [
  "flash-gateway-mock",
  "flash-gateway-real",
  "flash-node-mock",
  "flash-node-real",
];

function App() {
  const [activeSection, setActiveSection] = useState<Section>("gateway");
  const [backendUrl, setBackendUrl] = useState<string>(getBackendUrl);
  const [otaaKeys, setOtaaKeys] = useState({ devEui: "", appKey: "" });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  function handleNavigate(section: Section) {
    setActiveSection(section);
    if (FLASH_SECTIONS.includes(section)) {
      setSelectedCustomerId(null);
    }
  }

  const renderPanel = () => {
    if (FLASH_SECTIONS.includes(activeSection)) {
      if (!selectedCustomerId) {
        return (
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">{sectionTitle(activeSection)}</h2>
            </div>
            <div className="panel-body" style={{ flexDirection: "column" }}>
              <CustomerSelect backendUrl={backendUrl} onSelect={setSelectedCustomerId} />
            </div>
          </div>
        );
      }

      const deviceType = activeSection.replace("flash-", "") as
        | "gateway-mock"
        | "gateway-real"
        | "node-mock"
        | "node-real";
      return (
        <FlashWizard
          title={sectionTitle(activeSection)}
          deviceType={deviceType}
          backendUrl={backendUrl}
          selectedCustomerId={selectedCustomerId}
        />
      );
    }

    switch (activeSection) {
      case "gateway":  return <VirtualGatewayPanel onConfigLoaded={(devEui, appKey) => setOtaaKeys({ devEui, appKey })} />;
      case "users":    return <UserManagementPanel />;
      case "history":  return <HistoryPanel />;
      case "settings": return <SettingsPanel onUrlChange={setBackendUrl} devEui={otaaKeys.devEui} appKey={otaaKeys.appKey} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} backendUrl={backendUrl} />
      <main className="main-panel">
        {renderPanel()}
      </main>
    </div>
  );
}

function sectionTitle(section: Section): string {
  switch (section) {
    case "flash-gateway-mock": return "Flash Gateway Mock";
    case "flash-gateway-real": return "Flash Gateway Real";
    case "flash-node-mock":    return "Flash Node Mock";
    case "flash-node-real":    return "Flash Node Real";
    default:                   return "";
  }
}

export default App;
