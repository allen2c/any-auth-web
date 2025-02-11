import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  root: resolve(__dirname, "client"),
  plugins: [viteReact({ jsxRuntime: "classic" }), tailwindcss()],
};
