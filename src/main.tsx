
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

const updateSW = registerSW({
  immediate: true,
  // A new deploy no longer swaps the app out from under a mid-session customer
  // (the old skipWaiting/clientsClaim behavior) — they get a persistent toast
  // and choose when to update.
  onNeedRefresh() {
    toast("A new version of DapurNyonya is available", {
      description: "Update now to get the latest improvements.",
      duration: Infinity,
      action: {
        label: "Update",
        onClick: () => updateSW(true),
      },
    });
  },
  onRegisteredSW(swUrl) {
    console.info(`DapurNyonya service worker registered: ${swUrl}`);
  },
  onRegisterError(error) {
    console.error("DapurNyonya service worker registration failed", error);
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
  
