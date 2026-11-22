// Flat ESLint config enforcing size limits, complexity caps, and package boundaries.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importXPlugin from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";

const banDc2d = {
  group: ["@dc2d/*"],
  message: "this package may not depend on other @dc2d/* packages.",
};

const banNodeBuiltins = {
  group: ["node:*"],
  message: "this package must stay platform-free — no Node built-ins.",
};

const rendererBan = [
  { name: "pixi.js", message: "this package must stay renderer-free — no PixiJS." },
  { name: "three", message: "Three.js has been removed from this branch." },
  { name: "phaser", message: "Phaser has been removed from this branch." },
];

const wsBan = { name: "ws", message: "this package must not import ws directly." };

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", ".scratch/**", "packages/client/public/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "import-x": importXPlugin, sonarjs },
    settings: {
      "import-x/resolver": { node: { extensions: [".js", ".ts", ".mjs"] } },
    },
    languageOptions: { globals: { ...globals.es2024, ...globals.node } },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      complexity: ["error", { max: 8 }],
      "sonarjs/cognitive-complexity": ["error", 7],
      "max-lines-per-function": ["error", { max: 35, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 3],
      "max-params": ["error", 3],
      "max-statements-per-line": ["error", { max: 4 }],
      "sonarjs/no-duplicate-string": ["error", { threshold: 3 }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": ["warn", { minimumDescriptionLength: 10 }],
      "import-x/no-cycle": "error",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    files: ["packages/engine/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "no-restricted-imports": [
        "error",
        { paths: [...rendererBan, wsBan], patterns: [banNodeBuiltins, banDc2d] },
      ],
    },
  },
  {
    files: ["packages/content/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [...rendererBan, wsBan], patterns: [banNodeBuiltins, banDc2d] },
      ],
    },
  },
  {
    files: ["packages/client/**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "ws", message: "client runs in the browser — use WebSocket, not ws." },
            { name: "three", message: "Three.js has been removed from this branch." },
            { name: "phaser", message: "Phaser has been removed from this branch." },
          ],
          patterns: [{ group: ["@dc2d/game-server"], message: "client must not depend on game-server." }],
        },
      ],
    },
  },
  {
    files: ["packages/game-server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: rendererBan,
          patterns: [{ group: ["@dc2d/client"], message: "game-server must not depend on client." }],
        },
      ],
    },
  },
);
