import type { CommitLanguage, CommitMessageRequest, CommitStyle } from "../providers/types";

export interface BuiltPrompt {
  system: string;
  user: string;
}

// Builds the system + user prompts. Keeping the output clean rests on: (1) an
// explicit output contract ("ONLY the commit message"), (2) a WRONG/RIGHT
// contrast, and (3) concrete style rules. cleanMessage() is the safety net.
export function buildPrompt(req: CommitMessageRequest): BuiltPrompt {
  const system = [
    "You generate a git commit message from a diff.",
    "Output ONLY the commit message — no prose, no explanation, no markdown fences, no backticks, no surrounding quotes.",
    "",
    ...styleRules(req.style),
    "",
    languageRule(req.language),
    "",
    "Do not invent footers, issue numbers, or co-authors that are not present in the diff.",
    "",
    'WRONG output (never do this): "Here is the commit message:\\n```\\nfeat: add login\\n```"',
    "RIGHT output for that same case: feat: add login",
  ].join("\n");

  const user = buildUser(req);
  return { system, user };
}

function styleRules(style: CommitStyle): string[] {
  if (style === "conventional") {
    return [
      "Follow the Conventional Commits format:",
      "- Subject line: `type(scope): subject` where type is one of feat, fix, chore, docs, style, refactor, perf, test, build, ci. The scope in parentheses is optional.",
      "- The subject is imperative mood, lower-case, no trailing period, and at most ~72 characters.",
      "- If a body helps, add one blank line after the subject, then bullet points (`- `) explaining WHAT changed and WHY. Keep it concise; omit the body for trivial changes.",
    ];
  }
  return [
    "Use a free-form style:",
    "- A single concise subject line in imperative mood, at most ~72 characters, no trailing period.",
    "- Optionally a blank line then a short body explaining what/why.",
  ];
}

function languageRule(language: CommitLanguage): string {
  switch (language) {
    case "pt":
      return "Write the commit message in Portuguese.";
    case "auto":
      return "Write the commit message in the same language as the recent commit subjects provided below. If none are provided or the language is unclear, use English.";
    case "en":
    default:
      return "Write the commit message in English.";
  }
}

function buildUser(req: CommitMessageRequest): string {
  const parts: string[] = [];

  if (req.language === "auto" && req.recentSubjects.length > 0) {
    parts.push(
      "Recent commit subjects (match their language and style):",
      ...req.recentSubjects.slice(0, 20).map((s) => `- ${s}`),
      ""
    );
  }

  if (req.files.length > 0) {
    parts.push(
      "Changed files:",
      ...req.files.map((f) => `- ${f.status}: ${f.path}`),
      ""
    );
  }

  if (req.truncated) {
    parts.push(
      "Note: the diff below was truncated because it is large. Summarize the overall change using the file list and the available patch.",
      ""
    );
  }

  parts.push("Diff:", req.diff, "");
  parts.push("Respond with ONLY the commit message.");
  return parts.join("\n");
}
