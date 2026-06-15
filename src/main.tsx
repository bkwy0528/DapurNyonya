
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onRegisteredSW(swUrl) {
    console.info(`DapurNyonya service worker registered: ${swUrl}`);
  },
  onRegisterError(error) {
    console.error("DapurNyonya service worker registration failed", error);
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
  
