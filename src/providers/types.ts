// Provider abstraction so multiple AI backends (Claude today; others later) can
// be swapped behind a single interface.

export type CommitStyle = "conventional" | "free";
export type CommitLanguage = "en" | "pt" | "auto";

export interface CommitMessageRequest {
  /** The (possibly truncated) diff to summarize. */
  diff: string;
  /** True when the diff was cut to fit the budget. */
  truncated: boolean;
  /** Changed files with a readable status. */
  files: { path: string; status: string }[];
  /** Commit message style. */
  style: CommitStyle;
  /** Target language; "auto" resolves from recentSubjects. */
  language: CommitLanguage;
  /** Recent commit subjects, used as a language/style hint when language is auto. */
  recentSubjects: string[];
  /** Repository root, used as cwd so the provider can discover project context. */
  workspaceRoot?: string;
  /** Aborts the in-flight request when the user cancels. */
  signal: AbortSignal;
}

export interface CommitMessageProvider {
  readonly id: string;
  generate(req: CommitMessageRequest): Promise<string>;
}
