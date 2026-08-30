import { describe, it, expect, vi } from 'vitest';
import {
  runChat,
  runTool,
  isStatusQuestion,
  REFUSALS,
  MAX_ROUNDS,
  type ModelFn,
  type ToolCall,
} from '../src/chat';
import { openRouter } from '../src/model';
import { TRACES } from '../src/grader/fixtures';

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  id: `c-${name}`,
  function: { name, arguments: JSON.stringify(args) },
});

/** A model that asks for tools once, then answers with whatever it got. */
const grounded = (tc: ToolCall[], answer = 'Here is what the grader said.'): ModelFn => {
  let n = 0;
  return async () => (n++ === 0 ? { content: null, tool_calls: tc } : { content: answer });
};

const STATUS_WORD = /\b(PASS|FAIL|PARTIAL|DEGRADED|green|red|healthy)\b/i;

describe('refuse rather than answer ungrounded', () => {
  // THE demo failure: a confident status with no tool call behind it.
  it('refuses a status answer that called no tool', async () => {
    const model: ModelFn = async () => ({ content: 'Everything is green and healthy.' });
    const r = await runChat('is lakeside ai.txt ok?', model);
    expect(r.ok).toBe(false);
    expect(r.refused).toBe('ungrounded');
    expect(r.answer).toBe(REFUSALS.ungrounded);
    expect(r.toolCalls).toHaveLength(0);
  });

  it('no refusal text ever contains a status word', () => {
    for (const [k, v] of Object.entries(REFUSALS)) {
      expect(STATUS_WORD.test(v), `${k} leaked a status word`).toBe(false);
    }
  });

  it('a non-status question with no tool call is allowed through', async () => {
    const model: ModelFn = async () => ({ content: 'Harbor Coffee has three sites.' });
    const r = await runChat('how many sites are there?', model);
    expect(r.ok).toBe(true);
  });

  it('allows the answer once a tool actually ran', async () => {
    const r = await runChat(
      'is lakeside ai.txt ok?',
      grounded([call('explain_cell', { site: 'lakeside', check: 'ai_txt_live' })]),
    );
    expect(r.ok).toBe(true);
    expect(r.toolCalls).toHaveLength(1);
  });
});

describe('injected faults', () => {
  it('model timeout returns 502 and asserts no status', async () => {
    const model: ModelFn = async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    };
    const r = await runChat('is campus green?', model);
    expect(r.refused).toBe('model_unreachable');
    expect(r.httpStatus).toBe(502);
    expect(STATUS_WORD.test(r.answer)).toBe(false);
  });

  it('model 5xx returns 502', async () => {
    const model: ModelFn = async () => {
      throw new Error('openrouter 503');
    };
    const r = await runChat('is campus green?', model);
    expect(r.refused).toBe('model_unreachable');
    expect(r.httpStatus).toBe(502);
  });

  // A grader throw must not become "200 + a green story".
  it('a grader throw refuses instead of answering', async () => {
    const model: ModelFn = async () => ({
      content: null,
      tool_calls: [call('explain_cell', { site: 'lakeside', check: 'ai_txt_live' })],
    });
    const boom = vi.spyOn(await import('../src/grader'), 'explainCell').mockImplementation(() => {
      throw new Error('grader exploded');
    });
    const r = await runChat('is lakeside ok?', model);
    expect(boom).toHaveBeenCalled();
    boom.mockRestore();
    expect(r.refused).toBe('grader_error');
    expect(r.httpStatus).toBe(502);
    expect(STATUS_WORD.test(r.answer)).toBe(false);
  });

  it('a model that only ever asks for tools runs out of rounds and refuses', async () => {
    let calls = 0;
    const model: ModelFn = async () => {
      calls++;
      return { content: null, tool_calls: [call('grade')] };
    };
    const r = await runChat('is lakeside ok?', model);
    expect(r.refused).toBe('ungrounded');
    expect(r.rounds).toBe(MAX_ROUNDS);
    expect(calls).toBe(MAX_ROUNDS);
    expect(STATUS_WORD.test(r.answer)).toBe(false);
  });

  // The real model batches every site into ONE round. The cap was never the
  // constraint; a vague tool description was. Asserted so a schema edit that
  // reintroduces per-site calls shows up here.
  it('several tool calls in one round all resolve within that round', async () => {
    const model: ModelFn = (() => {
      let n = 0;
      return async () =>
        n++ === 0
          ? {
              content: null,
              tool_calls: [
                call('grade', { site: 'lakeside' }),
                call('grade', { site: 'campus' }),
                call('grade', { site: 'station' }),
              ].map((c, i) => ({ ...c, id: `c${i}` })),
            }
          : { content: 'All three graded.' };
    })();
    const r = await runChat('are we collecting reviews?', model);
    expect(r.ok).toBe(true);
    expect(r.rounds).toBe(2);
    expect(r.toolCalls).toHaveLength(3);
  });

  it('malformed tool arguments do not crash the loop', async () => {
    const model: ModelFn = (() => {
      let n = 0;
      return async () =>
        n++ === 0
          ? { content: null, tool_calls: [{ id: 'x', function: { name: 'grade', arguments: '{oops' } }] }
          : { content: 'done' };
    })();
    const r = await runChat('grade everything', model);
    expect(r.ok).toBe(true);
  });
});

describe('the loop injects real tool results', () => {
  it('hands the model the grader output, not a summary of it', async () => {
    const seen: string[] = [];
    const model: ModelFn = (() => {
      let n = 0;
      return async (messages) => {
        for (const m of messages) if (m.role === 'tool') seen.push(m.content);
        return n++ === 0
          ? { content: null, tool_calls: [call('explain_cell', { site: 'lakeside', check: 'ai_txt_live' })] }
          : { content: 'grounded' };
      };
    })();
    await runChat('is lakeside ai.txt ok?', model);
    expect(seen).toHaveLength(1);
    const payload = JSON.parse(seen[0]);
    expect(payload.status).toBe('FAIL');
    expect(payload.does_not_prove.length).toBeGreaterThan(0);
  });
});

describe('tools respect the ACL', () => {
  it('read_trace is denied to marketing through the tool layer', () => {
    const r = runTool('read_trace', { id: TRACES[0].id }, 'marketing') as {
      allowed: boolean;
      status: number;
    };
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(403);
  });

  it('read_trace is allowed for ops', () => {
    const r = runTool('read_trace', { id: TRACES[0].id }, 'ops') as { allowed: boolean };
    expect(r.allowed).toBe(true);
  });

  it('an unknown tool name returns an error, not a throw', () => {
    expect(runTool('rm_rf', {}, 'ops')).toHaveProperty('error');
  });

  it('grade on an unknown site errors rather than returning an empty green matrix', () => {
    expect(runTool('grade', { site: 'nope' }, 'guest')).toHaveProperty('error');
  });
});

describe('isStatusQuestion', () => {
  it('catches the phrasings the demo turns on', () => {
    for (const q of [
      'is lakeside ai.txt ok?',
      'why is campus green and lakeside not?',
      'are we collecting reviews?',
      'is the cron healthy so reviews are fine?',
    ]) {
      expect(isStatusQuestion(q), q).toBe(true);
    }
  });
});

describe('openRouter adapter throws so the loop can refuse', () => {
  it('throws on a non-2xx', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 503 }));
    await expect(openRouter({ apiKey: 'k' })([])).rejects.toThrow('openrouter 503');
    fetchMock.mockRestore();
  });

  it('throws on an aborted request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise((_, rej) => setTimeout(() => rej(new Error('The operation was aborted')), 5)),
    );
    await expect(openRouter({ apiKey: 'k', timeoutMs: 1 })([])).rejects.toThrow();
    fetchMock.mockRestore();
  });

  it('a thrown adapter becomes a refusal end to end', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 500 }));
    const r = await runChat('is lakeside green?', openRouter({ apiKey: 'k' }));
    fetchMock.mockRestore();
    expect(r.refused).toBe('model_unreachable');
    expect(r.httpStatus).toBe(502);
  });
});
