import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cleanMessage } from './cleanMessage.js';

void describe('cleanMessage', () => {
  void it('passes through a clean message unchanged', () => {
    const msg = 'feat: add user authentication';
    assert.equal(cleanMessage(msg), msg);
  });

  void it('extracts content from a code fence', () => {
    const raw = 'Here is the message:\n```\nfeat: add user authentication\n```';
    assert.equal(cleanMessage(raw), 'feat: add user authentication');
  });

  void it('strips leading prose preamble', () => {
    const raw = 'Here is the commit message:\nfeat: add auth';
    assert.equal(cleanMessage(raw), 'feat: add auth');
  });

  void it('strips wrapping quotes', () => {
    const raw = '"feat: add auth"';
    assert.equal(cleanMessage(raw), 'feat: add auth');
  });

  void it('strips wrapping backticks', () => {
    const raw = '`feat: add auth`';
    assert.equal(cleanMessage(raw), 'feat: add auth');
  });

  void it('trims surrounding whitespace', () => {
    const raw = '  feat: add auth  ';
    assert.equal(cleanMessage(raw), 'feat: add auth');
  });

  void it('handles empty input', () => {
    assert.equal(cleanMessage(''), '');
  });

  void it('handles prose-only input (no real message)', () => {
    assert.equal(cleanMessage('Sure, here you go!'), '');
  });

  void it('handles fence with language tag', () => {
    const raw = '```text\nfeat: add auth\n```';
    assert.equal(cleanMessage(raw), 'feat: add auth');
  });

  void it('preserves multi-line commit body', () => {
    const raw = 'feat: add auth\n\n- Added login page\n- Added session handling';
    assert.equal(cleanMessage(raw), raw);
  });
  
  void it("returns a plain message unchanged apart from trimming", () => {
    assert.equal(cleanMessage("  feat: add login  "), "feat: add login");
  });

  void it("extracts the contents of a markdown code fence", () => {
    const raw = "Here is the message:\n```\nfeat: add login\n```";
    assert.equal(cleanMessage(raw), "feat: add login");
  });

  void it("strips a single pair of quotes wrapping the whole message", () => {
    assert.equal(cleanMessage('"feat: add login"'), "feat: add login");
  });
});
