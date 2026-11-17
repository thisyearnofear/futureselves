/**
 * Ambient declaration for the removed @qvac/* packages.
 *
 * The packages are uninstalled (deps trimmed — Firebase AI Logic replaced
 * the local path). Dormant code still contains `await import("@qvac/sdk")`
 * calls; this makes every @qvac/* specifier resolve to `any` so tsc stays
 * happy. At bundle time Metro maps the same specifiers to stubs/@qvac/*.js.
 */
declare module "@qvac/*";
