import * as vscode from "vscode";
import type { CommitLanguage, CommitStyle } from "./providers/types";

// Typed view over the aiCommitMessage.* workspace settings.
export interface ExtensionConfig {
  style: CommitStyle;
  language: CommitLanguage;
  includeUnstagedFallback: boolean;
  claudeModel: string;
  claudeExecutablePath: string;
  fastMode: boolean;
}

export function readConfig(): ExtensionConfig {
  const c = vscode.workspace.getConfiguration("aiCommitMessage");
  return {
    style: c.get<CommitStyle>("style", "conventional"),
    language: c.get<CommitLanguage>("language", "en"),
    includeUnstagedFallback: c.get<boolean>("includeUnstagedFallback", true),
    claudeModel: c.get<string>("claude.model", "claude-sonnet-4-6"),
    claudeExecutablePath: c.get<string>("claude.executablePath", ""),
    fastMode: c.get<boolean>("fastMode", false),
  };
}
