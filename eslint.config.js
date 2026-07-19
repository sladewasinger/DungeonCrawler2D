// Flat ESLint config that mechanically enforces docs/ENGINEERING_STANDARDS.md:
// file/function size limits, `any`/non-null/ts-comment bans, and the per-package
// import boundaries from docs/ARCHITECTURE.md's dependency rule.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importXPlugin from "eslint-plugin-import-x";
import globals from "globals";

const banReference = {
  group: ["**/reference/**", "**/reference", "reference", "reference/**"],
  message: "reference/ is frozen v1 code — never import it.",
};

const banDc2d = {
  group: ["@dc2d/*"],
  message: "this package may not depend on other @dc2d/* packages.",
};

const banNodeBuiltins = {
  group: ["node:*"],
  message: "this package must stay platform-free — no Node built-ins.",
};

export default tseslint.config(
  { ignores: ["reference/**", "**/dist/**", "**/node_modules/**", ".scratch/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "import-x": importXPlugin },
    settings: {
      "import-x/resolver": { node: { extensions: [".js", ".ts", ".mjs"] } },
    },
    languageOptions: { globals: { ...globals.es2024, ...globals.node } },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["error", { max: 10 }],
      "@typescript-eslint/no-explicit-any": "error",
      // Default-deny elsewhere; packages/engine escalates both to "error" below.
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/ban-ts-comment": ["warn", { minimumDescriptionLength: 10 }],
      "import-x/no-cycle": "error",
      "no-restricted-imports": ["error", { patterns: [banReference] }],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    // engine: pure TS, zero deps except zod, forbidden `any`/`!`/ts-comments outright.
    files: ["packages/engine/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "phaser", message: "engine must stay platform-free — no Phaser." },
            { name: "ws", message: "engine must stay platform-free — no ws." },
          ],
          patterns: [banReference, banNodeBuiltins, banDc2d],
        },
      ],
    },
  },
  {
    // content: JSON data + zod schemas only.
    files: ["packages/content/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "phaser", message: "content is data + schemas only — no Phaser." },
            { name: "ws", message: "content is data + schemas only — no ws." },
          ],
          patterns: [banReference, banNodeBuiltins, banDc2d],
        },
      ],
    },
  },
  {
    // client: Phaser + engine + content; never the server transport.
    files: ["packages/client/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "ws", message: "client runs in the browser — use the native WebSocket, not ws." },
          ],
          patterns: [banReference, { group: ["@dc2d/game-server"], message: "client must not depend on game-server." }],
        },
      ],
    },
  },
  {
    // game-server: Node + ws + engine + content; never Phaser or the client.
    files: ["packages/game-server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "phaser", message: "game-server is headless — no Phaser." }],
          patterns: [banReference, { group: ["@dc2d/client"], message: "game-server must not depend on client." }],
        },
      ],
    },
  },
);
