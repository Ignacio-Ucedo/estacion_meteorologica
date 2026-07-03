import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import SettingsPanel from "./components/SettingsPanel";
import { getBackendUrl } from "./api/backend";
import "./App.css";

type Section = "gateway" | "users" | "settings";

function App() {
  const [activeSection, setActiveSection] = useState<Section>("gateway");
  const [backendUrl, setBackendUrl] = useState<string>(getBackendUrl);

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} backendUrl={backendUrl} />
      <main className="main-panel">
        {activeSection === "gateway" && <VirtualGatewayPanel />}
        {activeSection === "users" && <UserManagementPanel />}
        {activeSection === "settings" && <SettingsPanel onUrlChange={setBackendUrl} />}
      </main>
    </div>
  );
}

export default App;
