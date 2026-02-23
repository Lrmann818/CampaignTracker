import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/CampaignTracker/" : "/",
  build: {
    outDir: "dist"
  }
}));
