// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist/**", "coverage/**"] }, {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
        globals: globals.browser,
    },
    rules: {
        // Turned off — TypeScript enforces these more precisely via tsc
        "@typescript-eslint/no-unused-vars": "off",
        // Warnings for patterns common in pre-existing component code
        "@typescript-eslint/no-unused-expressions": "warn",
        "@typescript-eslint/no-empty-object-type": "warn",
        "@typescript-eslint/ban-ts-comment": "warn",
        "no-useless-assignment": "warn",
    },
}, storybook.configs["flat/recommended"]);
