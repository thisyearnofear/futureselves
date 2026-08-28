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

// ─── QVAC SDK web stub ───────────────────────────────────────────────────────
// The @qvac/sdk is native-only (on-device ML). Its dist code uses dynamic
// `import(importPath)` calls that Metro's transformer cannot statically parse,
// causing a SyntaxError during `expo export --platform web`. Every runtime
// call site already platform-guards with `Platform.OS !== "web"`, so the SDK
// is never executed on web — but Metro still parses it when it appears in the
// dependency graph. These resolver rules redirect @qvac/* to no-op stubs on
// web so the real native modules are never pulled into the web bundle.
const stubsDir = path.resolve(projectRoot, "stubs");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === "web" && moduleName.startsWith("@qvac/")) {
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
