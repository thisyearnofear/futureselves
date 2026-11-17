const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// Load environment variables from monorepo root
require("@expo/env").loadProjectEnv(monorepoRoot, { force: true });

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
];

// ─── QVAC SDK stub ───────────────────────────────────────────────────────────
// The @qvac/* packages are no longer installed (deps removed — the
// Firebase AI Logic hybrid path replaced local mode; ~5.4 GB of native
// runtimes trimmed). Dormant call sites still `await import("@qvac/sdk")`,
// so every @qvac/* specifier resolves to a throwing stub on ALL
// platforms — bundlers stay happy, and if a dormant path ever executes
// the stub throws and the caller's existing fallback path runs.
const stubsDir = path.resolve(projectRoot, "stubs");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith("@qvac/")) {
        const stubPath = path.join(stubsDir, moduleName) + ".js";
        return {
            filePath: stubPath,
            type: "sourceFile",
        };
    }
    // Fall back to the default resolver for everything else.
    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    // Metro's default export doesn't always set resolveRequest; use the
    // standard resolver path when it's absent.
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
