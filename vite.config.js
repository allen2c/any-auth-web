import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  root: resolve(__dirname, "client"),
  plugins: [viteReact({ jsxRuntime: "classic" }), tailwindcss()],
};
