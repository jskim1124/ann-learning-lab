import { defineConfig, loadEnv } from "vite";
import { researchApi } from './server/research/vitePlugin';

export default defineConfig(({ mode }) => ({
  define: { __RESEARCH_BUILD_ID__: JSON.stringify(process.env.RESEARCH_BUILD_ID ?? loadEnv(mode, process.cwd(), '').RESEARCH_BUILD_ID ?? 'development') },
  plugins: [researchApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })],
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    environment: "jsdom",
    coverage: { reporter: ["text", "html"] },
  },
}));
