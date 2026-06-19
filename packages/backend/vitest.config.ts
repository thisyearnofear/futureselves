import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@/lib/futureself": resolve(__dirname, "../../apps/default/lib/futureself"),
            "@/lib/ritual-logic": resolve(__dirname, "../../apps/default/lib/ritual-logic"),
            "@/lib/related-signals-logic": resolve(__dirname, "../../apps/default/lib/related-signals-logic"),
            "@/lib/audio-retry-policy": resolve(__dirname, "../../apps/default/lib/audio-retry-policy"),
        },
    },
    test: {
        environment: "edge-runtime",
        include: [
            "convex/**/*.test.ts",
            "convex/client-lib/**/*.test.ts",
        ],
        exclude: ["convex/_generated/**", "**/_generated/**"],
        passWithNoTests: true,
    },
    // Use esbuild for transforming aliased files outside the backend's
    // tsconfig tree (client lib code imported via aliases).
    esbuild: {
        tsconfigRaw: {
            compilerOptions: {
                target: "ES2020",
                module: "ESNext",
                moduleResolution: "Bundler",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                allowSyntheticDefaultImports: true,
            },
        },
    },
});
