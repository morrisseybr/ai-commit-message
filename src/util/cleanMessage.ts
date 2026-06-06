// Normalizes raw model output into a clean commit message.
// The model is prompted to return only the message, but this is the safety net
// for the occasional markdown fence, wrapping quotes, or prose preamble.

export function cleanMessage(raw: string): string {
  let text = raw;

  // If the model wrapped its answer in a markdown code fence (sometimes with
  // surrounding prose, e.g. "Here is the message:\n```\n...\n```"), take the
  // contents of the first fenced block and drop everything around it. The
  // `[^\n]*` after the opening fence swallows any language tag.
  const fence = text.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fence) {
    text = fence[1];
  }

  // Drop leading natural-language preamble lines the model may prepend (e.g.
  // "Here is the commit message:", "Sure, here you go:"). A real commit subject
  // (e.g. "feat: ...") does not match these openers.
  const proseStart =
    /^\s*(I['’]ll\b|I will\b|I'?m\b|Sure[,.! ]|Here(?:'s| is)\b|Let me\b|Looking at\b|Based on\b|This (?:commit|is|message)\b|The (?:commit|following|message|changes?)\b|Below\b)/i;
  const lines = text.split("\n");
  let firstReal = 0;
  while (firstReal < lines.length && proseStart.test(lines[firstReal])) {
    firstReal++;
  }
  text = firstReal >= lines.length ? "" : lines.slice(firstReal).join("\n");

  // Trim surrounding whitespace/newlines around the whole message.
  text = text.trim();

  // Strip a single pair of quotes/backticks wrapping the entire message (the
  // model sometimes quotes its answer). Only when the matching delimiter opens
  // and closes the whole string.
  const wrap = text.match(/^(["'`])([\s\S]*)\1$/);
  if (wrap) {
    text = wrap[2].trim();
  }

  return text;
}
