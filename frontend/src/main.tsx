import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import "./styles.css";

function Root() {
  const { token } = useAuth();
  return token ? <App /> : <LoginPage />;
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <Root />
  </AuthProvider>
);
