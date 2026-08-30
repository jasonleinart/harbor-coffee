import type { ChatMessage, ModelFn, ModelReply } from './chat';
import { TOOL_SCHEMA } from './chat';

/** Cheap by default. The exhibit is the grader; the model is plumbing. */
export const DEFAULT_MODEL = 'google/gemini-2.5-flash';

/** Abort well before a platform timeout so the refusal is ours, not a 522. */
export const TIMEOUT_MS = 20_000;

export interface ModelConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  referer?: string;
}

/**
 * OpenRouter adapter.
 *
 * Every non-2xx and every timeout THROWS, because runChat turns a throw into
 * the model_unreachable refusal. Returning a degraded reply instead would let
 * an unreachable model look like a model with nothing to say, and the loop
 * would answer from an empty context.
 */
export function openRouter(cfg: ModelConfig): ModelFn {
  return async (messages: ChatMessage[]): Promise<ModelReply> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? TIMEOUT_MS);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          authorization: `Bearer ${cfg.apiKey}`,
          'content-type': 'application/json',
          ...(cfg.referer ? { 'http-referer': cfg.referer } : {}),
          'x-title': 'Harbor Coffee',
        },
        body: JSON.stringify({
          model: cfg.model ?? DEFAULT_MODEL,
          messages,
          tools: TOOL_SCHEMA,
          tool_choice: 'auto',
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        throw new Error(`openrouter ${res.status}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ModelReply['tool_calls'] } }[];
      };
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error('openrouter: no choices');

      return { content: msg.content ?? null, tool_calls: msg.tool_calls };
    } finally {
      clearTimeout(timer);
    }
  };
}
