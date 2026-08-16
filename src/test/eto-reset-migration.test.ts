import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const resetMigrationPath = path.resolve(
  import.meta.dirname,
  "../../supabase/migrations/202608150003_reset_eto_profiles.sql",
);

describe("eto profile reset migration", () => {
  it("truncates historical groups before changing the profile schema", () => {
    const migration = readFileSync(resetMigrationPath, "utf8");

    expect(migration).toMatch(/^truncate table public\.groups cascade;/);
  });
});
