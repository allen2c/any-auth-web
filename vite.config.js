import { resolve, dirname } from "node:path"; // eslint-disable-line
import viteReact from "@vitejs/plugin-react";

export default {
  root: resolve(import.meta.dirname, "client"),
  plugins: [viteReact({ jsxRuntime: "classic" })],
};
