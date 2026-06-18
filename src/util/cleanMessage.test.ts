import { test } from "node:test";
import assert from "node:assert/strict";

import { cleanMessage } from "./cleanMessage";

test("returns a plain message unchanged apart from trimming", () => {
  assert.equal(cleanMessage("  feat: add login  "), "feat: add login");
});

test("extracts the contents of a markdown code fence", () => {
  const raw = "Here is the message:\n```\nfeat: add login\n```";
  assert.equal(cleanMessage(raw), "feat: add login");
});

test("strips a single pair of quotes wrapping the whole message", () => {
  assert.equal(cleanMessage('"feat: add login"'), "feat: add login");
});
