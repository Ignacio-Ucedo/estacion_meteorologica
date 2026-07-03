import { useState } from "react";
import Sidebar from "./components/Sidebar";
import VirtualGatewayPanel from "./components/VirtualGatewayPanel";
import UserManagementPanel from "./components/UserManagementPanel";
import SettingsPanel from "./components/SettingsPanel";
import ComingSoonPanel from "./components/ComingSoonPanel";
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

  const renderPanel = () => {
    switch (activeSection) {
      case "gateway":    return <VirtualGatewayPanel />;
      case "users":      return <UserManagementPanel />;
      case "settings":   return <SettingsPanel onUrlChange={setBackendUrl} />;
      case "flash-gateway-mock":
        return <ComingSoonPanel title="Flash Gateway Mock" description="Flasheá un ESP32 como gateway virtual desde un archivo .bin precompilado. Configuración de NVS y registro en ChirpStack incluidos." />;
      case "flash-gateway-real":
        return <ComingSoonPanel title="Flash Gateway Real" description="Flasheá el gateway de producción con credenciales WiFi y registro en ChirpStack de campo." />;
      case "flash-node-mock":
        return <ComingSoonPanel title="Flash Node Mock" description="Flasheá un ESP32 como nodo LoRa sin sensores para testear el pipeline completo en laboratorio." />;
      case "flash-node-real":
        return <ComingSoonPanel title="Flash Node Real" description="Flasheá el nodo meteorológico completo (DHT22 + pluviómetro + anemómetro). Verifica el primer uplink post-flash." />;
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
