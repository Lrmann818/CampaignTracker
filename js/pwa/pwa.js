import { registerSW } from "virtual:pwa-register";
import { hideUpdateBanner, showUpdateBanner } from "./updateBanner.js";

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log("[pwa] onNeedRefresh fired");
      showUpdateBanner({
        onRefresh: async () => {
          console.log("[pwa] Refresh clicked");
          await updateSW(true);
        },
        onDismiss: () => {
          console.log("[pwa] Later clicked");
          hideUpdateBanner();
        }
      });
    },
    onOfflineReady() {
      console.log("[pwa] onOfflineReady fired");
    }
  });
}
