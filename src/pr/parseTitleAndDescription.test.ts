import { test } from "node:test";
import assert from "node:assert/strict";

import { parseTitleAndDescription } from "./parseTitleAndDescription";

const MARKER = "<<<SPLIT>>>";

test("splits on the marker into a trimmed title and description", () => {
  const raw = "Add retry logic\n<<<SPLIT>>>\nWraps fetch in a backoff loop.";

  const result = parseTitleAndDescription(raw, MARKER);

  assert.deepEqual(result, {
    title: "Add retry logic",
    description: "Wraps fetch in a backoff loop.",
  });
});

test("returns undefined when the output is empty or whitespace", () => {
  assert.equal(parseTitleAndDescription("", MARKER), undefined);
  assert.equal(parseTitleAndDescription("   \n  \n", MARKER), undefined);
});

test("returns undefined when the marker leaves an empty title", () => {
  assert.equal(parseTitleAndDescription("<<<SPLIT>>>\njust a body", MARKER), undefined);
});

test("falls back to first-line title + rest body when the marker is absent", () => {
  const raw = "Add retry logic to the client\nWraps fetch in a backoff loop.\n- caps at 5 attempts";

  const result = parseTitleAndDescription(raw, MARKER);

  assert.equal(result?.title, "Add retry logic to the client");
  assert.equal(
    result?.description,
    "Wraps fetch in a backoff loop.\n- caps at 5 attempts"
  );
});

test("falls back to a title with no body when a marker-less output is single-line", () => {
  const result = parseTitleAndDescription("Just a title", MARKER);

  assert.equal(result?.title, "Just a title");
  assert.equal(result?.description, undefined);
});

test("preserves legitimate Markdown in the body", () => {
  const body = [
    "This change adds retry logic.",
    "",
    "## Changes",
    "- wraps `fetch` in a backoff loop",
    "- caps at 5 attempts",
    "",
    "```ts",
    "retry(fetch);",
    "```",
  ].join("\n");
  const raw = `Add retry logic\n<<<SPLIT>>>\n${body}`;

  const result = parseTitleAndDescription(raw, MARKER);

  assert.equal(result?.description, body);
});

test("strips stray quotes/fences the model may wrap around the title", () => {
  const raw = '"Add retry logic"\n<<<SPLIT>>>\nBody.';

  const result = parseTitleAndDescription(raw, MARKER);

  assert.equal(result?.title, "Add retry logic");
});

test("only the first marker splits; a later marker stays in the body", () => {
  const raw = "Title here\n<<<SPLIT>>>\nBody mentions <<<SPLIT>>> literally.";

  const result = parseTitleAndDescription(raw, MARKER);

  assert.equal(result?.title, "Title here");
  assert.equal(result?.description, "Body mentions <<<SPLIT>>> literally.");
});
