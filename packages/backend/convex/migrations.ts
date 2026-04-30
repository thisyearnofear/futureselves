import { Migrations } from "@convex-dev/migrations";
import type { ComponentApi as MigrationsComponentApi } from "@convex-dev/migrations/_generated/component.js";
import { DataModel } from "./_generated/dataModel";
import { components } from "./_generated/api";

// Convex codegen exposes installed components as generic component references here;
// the migrations client requires its package-specific component API shape.
const migrations = new Migrations<DataModel>(
    components.migrations as MigrationsComponentApi<"migrations">
);

export const run = migrations.runner();

// =============================================================================
// DEFINING MIGRATIONS
// =============================================================================
// Use migrations.define() to create migrations that process documents in batches.
// Each migration is idempotent and tracks progress by function name.
//
// IMPORTANT: Never rename migration functions after they've been run.
//
// Example: Backfill a new required field
//
// export const backfillCreatedAt = migrations.define({
//   table: "posts",
//   migrateOne: async (_ctx, doc) => {
//     if (doc.createdAt === undefined) {
//       return { createdAt: doc._creationTime };
//     }
//   },
// });
//
// Run a specific migration:
//   export const runBackfillCreatedAt = migrations.runner([backfillCreatedAt]);
//
// Run via convex_run tool:
//   functionName: "migrations:run"
//   args: {}                                          // run all pending
//   args: { fn: "migrations:backfillCreatedAt" }      // run specific
//   args: { dryRun: true }                            // dry run (one batch, no commit)
