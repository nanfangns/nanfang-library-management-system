import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".next_old/**",
    "node_modules/**",
    "node_modules_old/**",
    "data/**",
  ]),
]);
