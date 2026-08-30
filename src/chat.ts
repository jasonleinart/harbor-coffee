import { grade, explainCell, seed, CHECKS, SITES } from './grader';
import { listProcesses, whoCanSee, readTrace, listTraces } from './grader/acl';

export const MAX_ROUNDS = 3;

/**
 * A status word in an answer that never called a tool is the failure this
 * demo exists to show. Used to police the model's own output, not the user's.
 */
const STATUS_WORDS = /\b(PASS|FAIL|PARTIAL|DEGRADED|green|red|healthy|passing|failing)\b/i;

/** Questions that MUST be grounded in a tool call before they can be answered. */
export function isStatusQuestion(text: string): boolean {
  return /\b(status|health|healthy|green|red|ok|okay|broken|passing|failing|fresh|stale|collect\w*)\b/i.test(
    text,
  );
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface ModelReply {
  content: string | null;
  tool_calls?: ToolCall[];
}

/** The model call, injectable so the refuse paths can be tested with no key. */
export type ModelFn = (messages: ChatMessage[]) => Promise<ModelReply>;

export const SYSTEM_PROMPT = `You answer questions about the Harbor Coffee fleet: three synthetic sites (lakeside, campus, station) graded by a deterministic grader.

RULES, in order of importance:
1. You may NOT assert any cell status without calling grade or explain_cell in THIS turn. Not from memory, not from earlier in the conversation, not from what seems likely.
2. If a tool call fails or returns nothing, say you could not ground the answer. Never guess a status.
3. When you report a cell, include its does_not_prove line. A green cell is a claim under a stated rigor, not a guarantee.
4. NA means evaluated and does not apply. MANUAL means no machine decided it. They are different; never call either one "fine" or collapse them.
5. Check ids change. If a user names a retired id, explain_cell will resolve it; say which id is current.
6. NEVER ask which site before calling a tool. grade with no arguments returns all three sites, so a question that names no site is already answerable — call grade, then answer. Asking first turns a groundable question into a refusal.
7. A question that assumes one check implies another ("is the cron healthy so reviews are fine?") is two cells, not one. Grade both and say plainly where the assumption breaks.
8. NEVER decline a question you have a tool for, and never ask the user for an id. If you lack an id, call the tool with no arguments to list what exists. Call the tool FIRST; report what it returns.
9. A 403 is a real answer, not a failure. Report it as "your role cannot read this" and name the role. Never substitute a disclaimer about being a language model — the access boundary is the point, and the user asked about THIS system, not about you.

Tools: grade, explain_cell, list_processes, who_can_see, read_trace.`;

export const TOOL_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'grade',
      description:
        'Grade the fleet. Call with NO arguments to get all three sites at once — ' +
        'that is almost always what you want. Pass site only to narrow to one.',
      parameters: {
        type: 'object',
        properties: {
          site: {
            type: 'string',
            enum: ['lakeside', 'campus', 'station'],
            description: 'optional; omit to grade every site in one call',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explain_cell',
      description: 'One site x check: claim, rigor, status, proves, does_not_prove.',
      parameters: {
        type: 'object',
        properties: { site: { type: 'string' }, check: { type: 'string' } },
        required: ['site', 'check'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_processes',
      description: 'Processes with attendance and human_floor.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'who_can_see',
      description: 'Which roles can read a resource.',
      parameters: {
        type: 'object',
        properties: { resource: { type: 'string' } },
        required: ['resource'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_trace',
      description:
        'Read ops decision traces — the record of why a person overrode a default. ' +
        'Call with NO id to list every trace the current role may read; pass id only ' +
        'to fetch one. Denied for non-ops roles, and the denial is itself the answer ' +
        'to "why can I not see this".',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'optional; omit to list' } },
      },
    },
  },
];

export interface ToolResult {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

/** Dispatch one tool call. Throws are caught by the caller and become a refusal. */
export function runTool(name: string, args: Record<string, unknown>, role: string): unknown {
  const fx = seed();
  switch (name) {
    case 'grade': {
      const site = typeof args.site === 'string' ? args.site : undefined;
      const sites = site ? SITES.filter((s) => s.key === site) : SITES;
      if (site && sites.length === 0) return { error: `unknown site: ${site}` };
      return { cells: grade(fx, sites) };
    }
    case 'explain_cell':
      return explainCell(String(args.site ?? ''), String(args.check ?? ''), fx);
    case 'list_processes':
      return listProcesses(role);
    case 'who_can_see':
      return whoCanSee(String(args.resource ?? ''));
    case 'read_trace': {
      // No id means "what is there?". Authorization still comes first, so an
      // unauthorized caller learns nothing about which traces exist.
      const id = typeof args.id === 'string' ? args.id.trim() : '';
      return id ? readTrace(role, id) : listTraces(role);
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

export type RefuseReason = 'ungrounded' | 'model_unreachable' | 'grader_error';

export interface ChatResult {
  ok: boolean;
  answer: string;
  toolCalls: ToolResult[];
  rounds: number;
  refused?: RefuseReason;
  httpStatus: number;
}

const REFUSALS: Record<RefuseReason, string> = {
  ungrounded:
    'I could not ground that answer in the grader, so I will not state a status. Ask again, or check the matrix directly.',
  model_unreachable:
    'I could not reach the model. No status is asserted, because nothing was graded.',
  grader_error:
    'I could not reach the grader. No status is asserted, because nothing was graded.',
};

/**
 * The tool loop. Refuse rather than answer ungrounded.
 *
 * Every exit that is not a grounded answer returns one of REFUSALS, and none of
 * those strings contains a status word. That is deliberate: the failure mode
 * this whole exhibit is about is a confident sentence with nothing behind it,
 * and the cheapest way to never emit one is to make the failure text incapable
 * of carrying a verdict.
 */
export async function runChat(
  userText: string,
  model: ModelFn,
  role = 'guest',
  history: ChatMessage[] = [],
): Promise<ChatResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nThe current role is: ${role}.` },
    ...history,
    { role: 'user', content: userText },
  ];

  const toolCalls: ToolResult[] = [];
  let rounds = 0;

  while (rounds < MAX_ROUNDS) {
    rounds++;

    let reply: ModelReply;
    try {
      reply = await model(messages);
    } catch {
      return {
        ok: false,
        answer: REFUSALS.model_unreachable,
        toolCalls,
        rounds,
        refused: 'model_unreachable',
        httpStatus: 502,
      };
    }

    if (!reply.tool_calls || reply.tool_calls.length === 0) {
      const answer = reply.content ?? '';

      // The model answered with a verdict but never looked. This is the exact
      // lie the demo is about, so it is refused even though a reply exists.
      if (toolCalls.length === 0 && (isStatusQuestion(userText) || STATUS_WORDS.test(answer))) {
        return {
          ok: false,
          answer: REFUSALS.ungrounded,
          toolCalls,
          rounds,
          refused: 'ungrounded',
          httpStatus: 200,
        };
      }
      return { ok: true, answer, toolCalls, rounds, httpStatus: 200 };
    }

    messages.push({ role: 'assistant', content: reply.content ?? '', tool_calls: reply.tool_calls });

    for (const tc of reply.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }

      let result: unknown;
      try {
        result = runTool(tc.function.name, args, role);
      } catch (err) {
        // A grader throw must never become a green story.
        return {
          ok: false,
          answer: REFUSALS.grader_error,
          toolCalls,
          rounds,
          refused: 'grader_error',
          httpStatus: 502,
        };
      }

      toolCalls.push({ name: tc.function.name, args, result });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  // Out of rounds with the model still asking for tools.
  // No rescue round here: when the tool DESCRIPTIONS are right the model fetches
  // what it needs in one round, so hitting this cap means something is wrong with
  // the question or the schema. Spending a fourth call to summarise would hide
  // that signal behind a workaround.
  return {
    ok: false,
    answer: REFUSALS.ungrounded,
    toolCalls,
    rounds,
    refused: 'ungrounded',
    httpStatus: 200,
  };
}

export { REFUSALS };
