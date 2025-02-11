import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";

export default [
  js.configs.recommended,
  reactRecommended,
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      // Explicitly register the "import" plugin
      import: importPlugin,
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];
