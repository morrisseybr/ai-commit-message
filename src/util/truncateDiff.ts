// Caps how much diff we feed the model. A summary (commit message or PR body)
// rarely needs the full patch of a huge change; past this we keep the head of
// the diff and note how much was dropped. Shared by commit-message and PR
// generation so both apply the same budget.
export const MAX_DIFF_LINES = 8000;

export function truncateDiff(
  raw: string,
  maxLines: number = MAX_DIFF_LINES
): { diff: string; truncated: boolean } {
  const lines = raw.split("\n");
  if (lines.length <= maxLines) {
    return { diff: raw, truncated: false };
  }
  const kept = lines.slice(0, maxLines).join("\n");
  return {
    diff: `${kept}\n\n[diff truncated: ${lines.length - maxLines} more lines omitted]`,
    truncated: true,
  };
}
