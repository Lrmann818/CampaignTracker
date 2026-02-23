import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const base = mode === "production" ? "/CampaignTracker/" : "/";
  return {
    base,
    plugins: [
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon.png",
          "icons/*",
          "icons/dice/*",
          "icons/favicon.ico",
          "icons/apple-touch-icon.png"
        ],
        workbox: {
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      outDir: "dist"
    }
  };
});
