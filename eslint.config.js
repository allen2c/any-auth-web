import js from "@eslint/js";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";

export default [
  js.configs.recommended,
  reactRecommended,
  {
    files: ["**/*.js", "**/*.jsx"],
  },
];
