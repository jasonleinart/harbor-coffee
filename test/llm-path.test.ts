import { describe, it, expect } from 'vitest';
import recorded from '../evals/recorded-llm.json';
import { runChat, type ModelFn } from '../src/chat';

/**
 * The LLM path, replayed from REAL recorded model output.
 *
 * PLAN.md §8 says not to block merge on flaky OpenRouter, but a mock I wrote
 * myself only proves my own assumptions. These are actual google/gemini-2.5-flash
 * replies, so they catch the thing a hand-written mock cannot: the model asking
 * for a check id that does not exist. It asked for "ai.txt" when the id is
 * ai_txt_live, which exact-match resolution turned into a refusal.
 *
 * Re-record with: npx tsx record.mjs
 */
const replay = (n: number, answer = 'Grounded answer from the tool results.'): ModelFn => {
  let i = 0;
  return async () => {
    const r = recorded.cases[n].round1;
    return i++ === 0
      ? { content: r.content, tool_calls: r.tool_calls as never }
      : { content: answer };
  };
};

describe('recorded fixture integrity', () => {
  it('holds real replies that requested tools', () => {
    expect(recorded.cases.length).toBeGreaterThanOrEqual(2);
    for (const c of recorded.cases) {
      expect(c.round1.tool_calls.length, c.question).toBeGreaterThan(0);
    }
  });
});

describe('golden 1 through the real loop', () => {
  it('grounds, despite the model naming the check "ai.txt"', async () => {
    const c = recorded.cases[0];
    expect(c.round1.tool_calls[0].function.arguments).toContain('ai.txt');

    const r = await runChat(c.question, replay(0), 'ops');
    expect(r.refused).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(r.toolCalls).toHaveLength(1);

    const res = r.toolCalls[0].result as Record<string, string>;
    expect(res.check).toBe('order_online');
    expect(res.resolvedFrom).toBe('ai.txt');
    expect(res.status).toBe('FAIL');
    expect(res.does_not_prove.length).toBeGreaterThan(0);
  });
});

describe('golden 3 through the real loop', () => {
  it('batches every site into one round and answers in two', async () => {
    const c = recorded.cases[1];
    expect(c.round1.tool_calls.length).toBe(3);

    const r = await runChat(c.question, replay(1), 'ops');
    expect(r.ok).toBe(true);
    expect(r.rounds).toBe(2);
    expect(r.toolCalls).toHaveLength(3);
  });

  it('hands the model the stale-poll note, not a summary of it', async () => {
    const seen: string[] = [];
    const base = replay(1);
    const spy: ModelFn = async (messages) => {
      for (const m of messages) if (m.role === 'tool') seen.push(m.content);
      return base(messages);
    };
    await runChat(recorded.cases[1].question, spy, 'ops');
    const joined = seen.join('');
    expect(joined).toContain('76h');
    expect(joined).toContain('reviews_arriving');
  });
});

describe('the recorded path still refuses when the grader breaks', () => {
  it('a throw mid-loop refuses rather than answering from context', async () => {
    const base = replay(0);
    let n = 0;
    const model: ModelFn = async (m) => {
      if (n++ > 0) throw new Error('openrouter 503');
      return base(m);
    };
    const r = await runChat(recorded.cases[0].question, model, 'ops');
    expect(r.refused).toBe('model_unreachable');
    expect(r.httpStatus).toBe(502);
  });
});
