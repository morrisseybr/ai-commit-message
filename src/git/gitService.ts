import * as path from "path";
import * as vscode from "vscode";
import type { API, Change, GitExtension, Repository } from "../types/git";
import { truncateDiff } from "../util/truncateDiff";

// Reasons gitService can fail, so the command can show a tailored notification.
export type GitErrorCode = "no-extension" | "no-repo" | "nothing";

export class GitServiceError extends Error {
  constructor(readonly code: GitErrorCode, message: string) {
    super(message);
    this.name = "GitServiceError";
  }
}

// Mirrors the numeric values of the git API's `Status` const enum, which has no
// runtime representation (it's a `const enum` in a .d.ts), so we can't import it
// as a value. Order matches extensions/git/src/api/git.d.ts.
const STATUS_LABEL: Record<number, string> = {
  0: "modified", // INDEX_MODIFIED
  1: "added", // INDEX_ADDED
  2: "deleted", // INDEX_DELETED
  3: "renamed", // INDEX_RENAMED
  4: "copied", // INDEX_COPIED
  5: "modified", // MODIFIED
  6: "deleted", // DELETED
  7: "untracked", // UNTRACKED
  8: "ignored", // IGNORED
  9: "added", // INTENT_TO_ADD
  10: "renamed", // INTENT_TO_RENAME
  11: "type-changed", // TYPE_CHANGED
  12: "added", // ADDED_BY_US
  13: "added", // ADDED_BY_THEM
  14: "deleted", // DELETED_BY_US
  15: "deleted", // DELETED_BY_THEM
  16: "added", // BOTH_ADDED
  17: "deleted", // BOTH_DELETED
  18: "modified", // BOTH_MODIFIED
};

export interface ChangedFile {
  path: string;
  status: string;
}

export interface CommitContext {
  /** The (possibly truncated) diff text. */
  diff: string;
  /** True when the diff was cut to fit the budget. */
  truncated: boolean;
  /** Changed files with a readable status. */
  files: ChangedFile[];
  /** True when we fell back to the working-tree diff (nothing staged). */
  usedFallback: boolean;
}

// Resolves the git extension's API, activating the extension if needed.
async function getGitApi(): Promise<API> {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!ext) {
    throw new GitServiceError(
      "no-extension",
      "The built-in Git extension (vscode.git) is not available."
    );
  }
  const exports = ext.isActive ? ext.exports : await ext.activate();
  if (!exports.enabled) {
    throw new GitServiceError(
      "no-extension",
      "The built-in Git extension is disabled."
    );
  }
  return exports.getAPI(1);
}

// Picks the repository to operate on: the one backing the clicked SCM input box
// when available, otherwise the first/focused repository.
export async function resolveRepository(
  sourceControl?: vscode.SourceControl
): Promise<Repository> {
  const api = await getGitApi();
  const fromScm =
    sourceControl?.rootUri && api.getRepository(sourceControl.rootUri);
  const repo = fromScm || api.repositories[0];
  if (!repo) {
    throw new GitServiceError(
      "no-repo",
      "No Git repository found in this workspace."
    );
  }
  return repo;
}

// Reads the diff to summarize: staged first, falling back to the working tree
// when nothing is staged (if allowed). Throws "nothing" when there is nothing
// to commit. Truncates oversized diffs to a line budget.
export async function collectCommitContext(
  repo: Repository,
  includeUnstagedFallback: boolean
): Promise<CommitContext> {
  let raw = await repo.diff(true); // staged (git diff --cached)
  let usedFallback = false;
  let changes: readonly Change[] = repo.state.indexChanges;

  if (!raw.trim()) {
    if (!includeUnstagedFallback) {
      throw new GitServiceError(
        "nothing",
        "Nothing staged to commit. Stage changes or enable aiCommitMessage.includeUnstagedFallback."
      );
    }
    raw = await repo.diff(false); // working tree
    usedFallback = true;
    changes = repo.state.workingTreeChanges;
  }

  if (!raw.trim()) {
    throw new GitServiceError("nothing", "Nothing to commit.");
  }

  const files = changes.map((c) => describeChange(repo, c));
  const { diff, truncated } = truncateDiff(raw);

  return { diff, truncated, files, usedFallback };
}

// Recent commit subjects, used as a language/style hint (for language: "auto").
export async function recentSubjects(repo: Repository): Promise<string[]> {
  try {
    const commits = await repo.log({ maxEntries: 20 });
    return commits
      .map((c) => c.message.split("\n", 1)[0].trim())
      .filter((s) => s.length > 0);
  } catch {
    // Shallow clones / brand-new repos have no log; that's fine.
    return [];
  }
}

function describeChange(repo: Repository, change: Change): ChangedFile {
  const rel = path.relative(repo.rootUri.fsPath, change.uri.fsPath) || change.uri.fsPath;
  return {
    path: rel.split(path.sep).join("/"),
    status: STATUS_LABEL[change.status as number] ?? "changed",
  };
}
