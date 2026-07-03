import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import "./App.css";

type Section = "gateway" | "users";

function App() {
  const [activeSection, setActiveSection] = useState<Section>("gateway");

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
      <main className="main-panel">
        {activeSection === "gateway" && <VirtualGatewayPanel />}
        {activeSection === "users" && <UserManagementPanel />}
      </main>
    </div>
  );
}

export default App;
