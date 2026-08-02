// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config({ ignores: ["dist/**", "coverage/**"] }, {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
        globals: globals.browser,
    },
    // The codebase was already written against this plugin — several files carry
    // `eslint-disable-next-line react-hooks/exhaustive-deps` — but it had never
    // been registered, so every one of those comments was an "unknown rule"
    // error and no hook was actually being checked.
    plugins: { "react-hooks": reactHooks },
    rules: {
        // Only the two classic rules. The plugin's `recommended-latest` preset
        // also turns on the React Compiler rule set (static-components, purity,
        // immutability, ...) as errors, which is a much larger change than
        // making the existing disable comments resolve.
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        // Turned off — TypeScript enforces these more precisely via tsc
        "@typescript-eslint/no-unused-vars": "off",
        // Warnings for patterns common in pre-existing component code
        "@typescript-eslint/no-unused-expressions": "warn",
        "@typescript-eslint/no-empty-object-type": "warn",
        "@typescript-eslint/ban-ts-comment": "warn",
        "no-useless-assignment": "warn",
    },
}, storybook.configs["flat/recommended"]);
