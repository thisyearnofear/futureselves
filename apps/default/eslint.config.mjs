import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/_generated/**",
            "**/_bloom/**",
            "**/convex/_generated/**",
            "**/convex/_bloom/**",
            "**/.expo/**",
            "**/dist/**",
            "**/build/**",
            "../../packages/backend/convex/_generated/**",
            "../../packages/backend/convex/_bloom/**",
        ],
    },
    ...tseslint.configs.recommended,
    ...convexPlugin.configs.recommended,
    {
        files: ["metro.config.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];
