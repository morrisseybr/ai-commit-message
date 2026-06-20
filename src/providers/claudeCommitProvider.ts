import { buildPrompt } from "../prompt/buildPrompt";
import { cleanMessage } from "../util/cleanMessage";
import type { CommitMessageProvider, CommitMessageRequest } from "./types";

// The agent SDK is ESM-only; VSCode extensions are CommonJS. Load it lazily via
// a dynamic import so the require/ESM mismatch is resolved at runtime, and so we
// don't pay the import cost until the first generation.
type QueryFn = typeof import("@anthropic-ai/claude-agent-sdk").query;
let queryFnPromise: Promise<QueryFn> | undefined;
function getQuery(): Promise<QueryFn> {
  if (!queryFnPromise) {
    queryFnPromise = import("@anthropic-ai/claude-agent-sdk").then((m) => m.query);
  }
  return queryFnPromise;
}

export interface ClaudeProviderConfig {
  model: string;
  // Disable the model's extended thinking. For a commit message it trades a bit
  // of quality for ~3x lower latency; enabled by the fast-mode toggle.
  disableThinking: boolean;
  // Path to the user's claude binary. Always set in practice — the package ships
  // without the SDK's bundled binary, so the SDK needs an explicit path.
  executablePath?: string;
  onLog?: (message: string) => void;
}

export class ClaudeCommitProvider implements CommitMessageProvider {
  readonly id = "claude";

  constructor(private readonly cfg: ClaudeProviderConfig) {}

  async generate(req: CommitMessageRequest): Promise<string> {
    const { system, user } = buildPrompt(req);

    // The SDK accepts its own AbortController; bridge the request's signal to it.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (req.signal.aborted) {
      controller.abort();
    } else {
      req.signal.addEventListener("abort", onAbort, { once: true });
    }

    const started = Date.now();
    let collected = "";

    try {
      const query = await getQuery();
      const stream = query({
        prompt: user,
        options: {
          model: this.cfg.model,
          systemPrompt: system,
          allowedTools: [],
          maxTurns: 1,
          cwd: req.workspaceRoot,
          abortController: controller,
          ...(this.cfg.disableThinking
            ? { thinking: { type: "disabled" as const } }
            : {}),
          // Use the user's installed claude binary (the package omits the SDK's).
          ...(this.cfg.executablePath
            ? { pathToClaudeCodeExecutable: this.cfg.executablePath }
            : {}),
        },
      });

      for await (const message of stream) {
        if (controller.signal.aborted) {
          break;
        }
        if (message.type === "assistant") {
          for (const block of message.message.content) {
            if (block.type === "text") {
              collected += block.text;
            }
          }
        } else if (message.type === "result") {
          if (message.subtype === "success" && typeof message.result === "string") {
            collected = message.result; // authoritative final text
          }
          break;
        }
      }
    } finally {
      req.signal.removeEventListener("abort", onAbort);
    }

    const text = cleanMessage(collected);
    this.cfg.onLog?.(
      `claude commit message in ${Date.now() - started}ms, ${text.length} chars`
    );
    return text;
  }
}
