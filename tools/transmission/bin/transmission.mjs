#!/usr/bin/env node
/**
 * Convenience wrapper so `transmission` works as a global-ish command.
 * Users invoke: node bin/transmission.mjs ...
 */
import("../src/cli.ts").catch(async (e) => {
  // Fall back: the src file is TS — try to import via tsx loader.
  console.error(`Direct import failed: ${e.message}`);
  console.error(`Tip: run via 'npm start -- <args>' or 'npx tsx src/cli.ts <args>'`);
  process.exit(1);
});
