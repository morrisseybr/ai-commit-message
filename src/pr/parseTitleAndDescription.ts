import { cleanMessage } from "../util/cleanMessage";

export interface TitleAndDescription {
  title: string;
  description?: string;
}

// Splits the model's single response into a PR title and description on the
// first occurrence of the marker. The title is sanitized like a commit message
// (stray fences/quotes removed); the body is left as-is so legitimate Markdown
// survives.
export function parseTitleAndDescription(
  raw: string,
  marker: string
): TitleAndDescription | undefined {
  const at = raw.indexOf(marker);

  // Graceful fallback when the model omitted the marker: the first non-empty
  // line is the title, everything after it is the body.
  if (at === -1) {
    const cleaned = cleanMessage(raw);
    if (!cleaned) {
      return undefined;
    }
    const newline = cleaned.indexOf("\n");
    if (newline === -1) {
      return { title: cleaned };
    }
    const title = cleaned.slice(0, newline).trim();
    const description = cleaned.slice(newline + 1).trim();
    return description ? { title, description } : { title };
  }

  const title = cleanMessage(raw.slice(0, at));
  if (!title) {
    return undefined;
  }
  const description = raw.slice(at + marker.length).trim();
  return description ? { title, description } : { title };
}
