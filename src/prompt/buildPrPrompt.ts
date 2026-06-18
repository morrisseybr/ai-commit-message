import type { CommitLanguage } from "../providers/types";
import type { BuiltPrompt } from "./buildPrompt";

// A unique, improbable line the model puts between the title and the body so we
// can split the single response. Deliberately not a bare `---`, which is valid
// Markdown and would appear in real PR bodies.
export const PR_SPLIT_MARKER = "<<<AICM::PR-TITLE-BODY-SPLIT::9f3a7c>>>";

export interface PrPromptRequest {
  /** The (possibly truncated) flattened diff to summarize. */
  diff: string;
  /** True when the diff was cut to fit the budget. */
  truncated: boolean;
  /** The PR's commit messages — context and the language hint for `auto`. */
  commitMessages: string[];
  /** Target language; "auto" resolves from commitMessages. */
  language: CommitLanguage;
}

// Builds the system + user prompts for generating a PR title and description in
// a single call. Unlike the commit prompt, the title is a plain readable
// sentence (no Conventional Commits style) and the body is Markdown.
export function buildPrPrompt(req: PrPromptRequest): BuiltPrompt {
  const system = [
    "You generate a title and description for a GitHub pull request from a diff.",
    "",
    "Output exactly two parts separated by a line containing only this marker:",
    PR_SPLIT_MARKER,
    "",
    "Before the marker: the TITLE — a single plain, readable sentence summarizing the change. Do not use Conventional Commits prefixes (no `feat:`/`fix:`), no trailing period, no quotes, no Markdown.",
    "After the marker: the DESCRIPTION — Markdown is allowed and encouraged. Start with a short summary paragraph, then a bulleted list (`- `) of the notable changes.",
    "",
    languageRule(req.language),
    "",
    "Do not invent issue numbers, footers, or co-authors that are not present in the diff.",
  ].join("\n");

  const user = buildUser(req);
  return { system, user };
}

function languageRule(language: CommitLanguage): string {
  switch (language) {
    case "pt":
      return "Write the title and description in Portuguese.";
    case "auto":
      return "Write the title and description in the same language as the commit messages provided below. If none are provided or the language is unclear, use English.";
    case "en":
    default:
      return "Write the title and description in English.";
  }
}

function buildUser(req: PrPromptRequest): string {
  const parts: string[] = [];

  if (req.language === "auto" && req.commitMessages.length > 0) {
    parts.push(
      "Commit messages on this branch (match their language):",
      ...req.commitMessages.slice(0, 20).map((m) => `- ${m}`),
      ""
    );
  }

  if (req.truncated) {
    parts.push(
      "Note: the diff below was truncated because it is large. Summarize the overall change from the available patch.",
      ""
    );
  }

  parts.push("Diff:", req.diff, "");
  parts.push(`Respond with the title, then a line containing only ${PR_SPLIT_MARKER}, then the description.`);
  return parts.join("\n");
}
