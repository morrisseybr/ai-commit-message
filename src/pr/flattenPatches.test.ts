import { test } from "node:test";
import assert from "node:assert/strict";

import { flattenPatches } from "./flattenPatches";

test("flattens a string[] of patches into one diff, not truncated", () => {
  const a = "diff --git a/a.ts b/a.ts\n+const a = 1;";
  const b = "diff --git a/b.ts b/b.ts\n+const b = 2;";

  const result = flattenPatches([a, b]);

  assert.equal(result.truncated, false);
  assert.ok(result.diff.includes("+const a = 1;"));
  assert.ok(result.diff.includes("+const b = 2;"));
});

test("flattens the object shape with a per-file header naming each file", () => {
  const result = flattenPatches([
    { patch: "+const a = 1;", fileUri: "file:///repo/src/a.ts" },
    { patch: "+const b = 2;", fileUri: "file:///repo/src/b.ts" },
  ]);

  assert.equal(result.truncated, false);
  // Each file's path appears as a header before its patch.
  assert.ok(result.diff.includes("src/a.ts"));
  assert.ok(result.diff.includes("src/b.ts"));
  assert.ok(result.diff.indexOf("src/a.ts") < result.diff.indexOf("+const a = 1;"));
});

test("surfaces truncated=true when the joined diff exceeds the line budget", () => {
  const huge = Array.from({ length: 9000 }, (_, i) => `+line ${i}`).join("\n");

  const result = flattenPatches([huge]);

  assert.equal(result.truncated, true);
  assert.ok(result.diff.includes("diff truncated"));
});

test("a renamed file's header reflects the previous path", () => {
  const result = flattenPatches([
    {
      patch: "+const a = 1;",
      fileUri: "file:///repo/src/new.ts",
      previousFileUri: "file:///repo/src/old.ts",
    },
  ]);

  assert.ok(result.diff.includes("src/old.ts"));
  assert.ok(result.diff.includes("src/new.ts"));
});
