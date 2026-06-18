import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPrPrompt, PR_SPLIT_MARKER } from "./buildPrPrompt";

test("basic contract: marker, plain title, Markdown body, and the diff", () => {
  const { system, user } = buildPrPrompt({
    diff: "diff --git a/a.ts b/a.ts\n+const a = 1;",
    truncated: false,
    commitMessages: [],
    language: "en",
  });
  const all = `${system}\n${user}`;

  // The unique split marker the parser keys on must be in the instructions.
  assert.ok(PR_SPLIT_MARKER.length > 0);
  assert.notEqual(PR_SPLIT_MARKER.trim(), "---");
  assert.ok(all.includes(PR_SPLIT_MARKER));

  // Title is a plain sentence (conventional-commit style does not apply); body
  // is Markdown with a summary paragraph + bulleted list.
  assert.match(system, /title/i);
  assert.match(system, /description|body/i);
  assert.match(system, /markdown/i);
  assert.match(system, /bullet/i);

  // The diff is handed to the model in the user prompt.
  assert.ok(user.includes("+const a = 1;"));
});

test("auto language feeds the commit messages as the language hint", () => {
  const { user } = buildPrPrompt({
    diff: "x",
    truncated: false,
    commitMessages: ["feat: adiciona login", "fix: corrige bug"],
    language: "auto",
  });

  assert.ok(user.includes("feat: adiciona login"));
  assert.ok(user.includes("fix: corrige bug"));
});

test("non-auto language does not dump the commit messages into the prompt", () => {
  const { user } = buildPrPrompt({
    diff: "x",
    truncated: false,
    commitMessages: ["feat: adiciona login"],
    language: "en",
  });

  assert.ok(!user.includes("feat: adiciona login"));
});

test("truncated diff adds a truncation note", () => {
  const { user } = buildPrPrompt({
    diff: "x",
    truncated: true,
    commitMessages: [],
    language: "en",
  });

  assert.match(user, /truncated/i);
});
