import { truncateDiff } from "../util/truncateDiff";

// A single file's patch as the GitHub PR extension hands it to us in the
// object-shaped `context.patches`.
export interface FilePatch {
  patch: string;
  fileUri: string;
  previousFileUri?: string;
}

export type Patches = string[] | FilePatch[];

// Joins the host-provided per-file patches into one diff text and applies the
// shared line budget. We never compute the diff ourselves — `patches` comes
// straight from the host, so base/compare-branch changes "just work".
export function flattenPatches(patches: Patches): {
  diff: string;
  truncated: boolean;
} {
  const blocks = patches.map((p) =>
    typeof p === "string" ? p : `${fileHeader(p)}\n${p.patch}`
  );
  const joined = blocks.join("\n\n");
  return truncateDiff(joined);
}

// A readable header naming the file a patch belongs to. For renames it shows
// the previous path too. The host gives us the file URIs separately from the
// patch text, so we surface them explicitly.
function fileHeader(p: FilePatch): string {
  const to = fileLabel(p.fileUri);
  if (p.previousFileUri && p.previousFileUri !== p.fileUri) {
    return `=== ${fileLabel(p.previousFileUri)} → ${to} ===`;
  }
  return `=== ${to} ===`;
}

// Turns a file URI into a repo-relative-ish path for display, falling back to
// the raw string if it doesn't parse as a URI.
function fileLabel(uri: string): string {
  try {
    return decodeURIComponent(new URL(uri).pathname).replace(/^\/+/, "");
  } catch {
    return uri;
  }
}
