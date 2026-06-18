import { ClaudeCommitProvider } from "./claudeCommitProvider";
import { ClaudePrProvider } from "./claudePrProvider";
import type { ClaudeCoreConfig } from "./claudeQuery";
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

// Resolves the shared Claude wiring from settings. Fast mode swaps in a fast
// model and disables extended thinking; otherwise we keep the configured model
// with thinking on (quality > latency for a one-shot action) unless the user
// explicitly disables thinking. Shared by commit-message and PR generation so
// both honor the same settings — no PR-specific settings exist.
function resolveCoreConfig(settings: ProviderSettings): ClaudeCoreConfig {
  return {
    model: settings.fastMode ? FAST_MODEL : settings.claudeModel,
    disableThinking: settings.fastMode || settings.disableThinking,
    executablePath: settings.claudeExecutablePath,
  };
}

// Builds the commit-message provider from settings.
export function createProvider(settings: ProviderSettings): CommitMessageProvider {
  return new ClaudeCommitProvider({
    ...resolveCoreConfig(settings),
    onLog: settings.onLog,
  });
}

// Builds the PR title+description provider from the same settings.
export function createPrProvider(settings: ProviderSettings): ClaudePrProvider {
  return new ClaudePrProvider({
    ...resolveCoreConfig(settings),
    onLog: settings.onLog,
  });
}
