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

test("template present: the prompt mirrors the template instead of summary+bullets", () => {
  const template = [
    "## Description",
    "",
    "## Checklist",
    "- [ ] Tests added",
    "- [ ] Docs updated",
    "",
    "## Screenshots",
  ].join("\n");

  const { system, user } = buildPrPrompt({
    diff: "diff --git a/a.ts b/a.ts\n+const a = 1;",
    truncated: false,
    commitMessages: [],
    language: "en",
    template,
  });
  const all = `${system}\n${user}`;

  // The template's own structure is handed to the model to mirror.
  assert.ok(all.includes("## Checklist"));
  assert.ok(all.includes("## Screenshots"));

  // The model is told to mirror the template, fill only what the diff supports,
  // leave unfillable sections and checkbox states untouched, and not fabricate.
  assert.match(system, /template/i);
  assert.match(system, /do not (invent|fabricate)|never (invent|fabricate)/i);
  assert.match(system, /checkbox|check ?box/i);

  // The default summary+bullets instruction does not apply in this branch.
  assert.ok(!/bulleted list/i.test(system));
});

test("template absent: falls back to the summary + bulleted list, no mirroring", () => {
  const { system } = buildPrPrompt({
    diff: "x",
    truncated: false,
    commitMessages: [],
    language: "en",
  });

  // Walking-skeleton body instruction is retained.
  assert.match(system, /summary paragraph/i);
  assert.match(system, /bulleted list/i);

  // No template-mirroring language leaks in when there is no template.
  assert.ok(!/mirror the template/i.test(system));
  assert.ok(!/checkbox/i.test(system));
});

test("whitespace-only template is treated as absent", () => {
  const { system, user } = buildPrPrompt({
    diff: "x",
    truncated: false,
    commitMessages: [],
    language: "en",
    template: "   \n\t  \n",
  });

  // Blank template must not flip us into the mirroring branch.
  assert.match(system, /bulleted list/i);
  assert.ok(!/mirror the template/i.test(system));
  assert.ok(!user.includes("template to fill in"));
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
