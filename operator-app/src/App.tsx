import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import "./App.css";

type Section = "gateway";

function App() {
  const [activeSection, setActiveSection] = useState<Section>("gateway");

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
      <main className="main-panel">
        {activeSection === "gateway" && <VirtualGatewayPanel />}
      </main>
    </div>
  );
}

export default App;
