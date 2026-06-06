import { ClaudeCommitProvider } from "./claudeCommitProvider";
import type { CommitMessageProvider } from "./types";

// A fast model for the fast-mode toggle: lower latency, slightly lower quality.
const FAST_MODEL = "claude-haiku-4-5-20251001";

export interface ProviderSettings {
  claudeModel: string;
  fastMode: boolean;
  disableThinking: boolean;
  claudeExecutablePath?: string;
  onLog?: (message: string) => void;
}

// Builds the commit-message provider from settings. Fast mode swaps in a fast
// model and disables extended thinking; otherwise we keep the configured model
// with thinking on (quality > latency for a one-shot action) unless the user
// explicitly disables thinking.
export function createProvider(settings: ProviderSettings): CommitMessageProvider {
  return new ClaudeCommitProvider({
    model: settings.fastMode ? FAST_MODEL : settings.claudeModel,
    disableThinking: settings.fastMode || settings.disableThinking,
    executablePath: settings.claudeExecutablePath,
    onLog: settings.onLog,
  });
}
