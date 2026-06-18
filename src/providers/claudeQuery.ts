// Shared low-level Claude call used by both commit-message and PR generation.
// Owns the lazy SDK import, the single-turn streaming loop, and the
// AbortSignal→AbortController bridge so callers only deal with prompts in/text
// out.

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

export interface ClaudeCoreConfig {
  model: string;
  // Disable the model's extended thinking — trades a bit of quality for ~3x
  // lower latency; enabled by the fast-mode toggle.
  disableThinking: boolean;
  // Path to the user's claude binary. Always set in practice — the package ships
  // without the SDK's bundled binary, so the SDK needs an explicit path.
  executablePath?: string;
}

export interface ClaudeQueryInput {
  system: string;
  user: string;
  signal: AbortSignal;
  workspaceRoot?: string;
}

// Runs a single-turn Claude query and returns the raw final text. Callers are
// responsible for cleaning/parsing the result.
export async function runClaudeText(
  cfg: ClaudeCoreConfig,
  input: ClaudeQueryInput
): Promise<string> {
  // The SDK accepts its own AbortController; bridge the request's signal to it.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (input.signal.aborted) {
    controller.abort();
  } else {
    input.signal.addEventListener("abort", onAbort, { once: true });
  }

  let collected = "";

  try {
    const query = await getQuery();
    const stream = query({
      prompt: input.user,
      options: {
        model: cfg.model,
        systemPrompt: input.system,
        allowedTools: [],
        maxTurns: 1,
        cwd: input.workspaceRoot,
        abortController: controller,
        ...(cfg.disableThinking
          ? { thinking: { type: "disabled" as const } }
          : {}),
        // Use the user's installed claude binary (the package omits the SDK's).
        ...(cfg.executablePath
          ? { pathToClaudeCodeExecutable: cfg.executablePath }
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
    input.signal.removeEventListener("abort", onAbort);
  }

  return collected;
}
