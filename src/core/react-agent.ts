import type { Tool } from '../types/tool';
import type { GenerateOptions, ModelResponse } from '../types/model';
import type { EventBus } from '../types/event';
import type { Sandbox } from '../security/sandbox';
import { ERROR_TYPES, LQiaoError } from '../types/error';
import { withRetry } from '../utils/retry';

/** Parsed action from model output */
interface ParsedAction {
  thought?: string;
  action?: string;
  args?: Record<string, unknown>;
  finalAnswer?: string;
}

/** Default ReAct prompt template */
const DEFAULT_REACT_PROMPT = `You are an AI assistant that solves tasks step by step.

Use the following format:

Thought: consider what to do next
Action: tool_name
Action Input: {"key": "value"}
Observation: result of the action
... (repeat Thought/Action/Observation as needed)
Thought: I now know the final answer
Final Answer: the final response to the user

Available tools:
{{TOOLS}}

Task: {{TASK}}

Begin.
`;

/**
 * ReAct Agent — implements the Thought → Action → Observation loop.
 */
export class ReactAgent {
  #tools: Map<string, Tool>;
  #eventBus?: EventBus;
  #maxSteps: number;
  #maxRetries: number;
  #sandbox?: Sandbox;

  constructor(config: {
    tools: Tool[];
    eventBus?: EventBus;
    maxSteps?: number;
    maxRetries?: number;
    sandbox?: Sandbox;
  }) {
    this.#tools = new Map(config.tools.map((t) => [t.name, t]));
    this.#eventBus = config.eventBus;
    this.#maxSteps = config.maxSteps ?? 50;
    this.#maxRetries = config.maxRetries ?? 3;
    this.#sandbox = config.sandbox;
  }

  /**
   * Run the ReAct loop against a model provider.
   * @param generate Model generation function
   * @param task The task/prompt to solve
   */
  async run(
    generate: (prompt: string, options?: GenerateOptions) => Promise<ModelResponse>,
    task: string,
  ): Promise<string> {
    const history: string[] = [];
    const toolsDesc = Array.from(this.#tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    let prompt = DEFAULT_REACT_PROMPT.replace('{{TOOLS}}', toolsDesc).replace('{{TASK}}', task);

    for (let step = 0; step < this.#maxSteps; step++) {
      this.#eventBus?.emit('onStep', { step, prompt });

      const response = await withRetry(
        () => generate(prompt),
        { maxRetries: this.#maxRetries },
      );

      const parsed = this.#parseResponse(response.text);
      history.push(response.text);

      if (parsed.finalAnswer) {
        this.#eventBus?.emit('afterRun', { answer: parsed.finalAnswer, steps: step + 1 });
        return parsed.finalAnswer;
      }

      if (parsed.action) {
        const tool = this.#tools.get(parsed.action);
        if (!tool) {
          history.push(`Observation: Tool "${parsed.action}" not found`);
          prompt += `\n\n${response.text}\nObservation: Tool "${parsed.action}" not found`;
          continue;
        }

        this.#eventBus?.emit('onToolCall', { tool: parsed.action, args: parsed.args });

        try {
          const result = await tool.execute(
            ...(parsed.args ? [parsed.args] : []),
          );
          const observation = result.success
            ? JSON.stringify(result.data)
            : result.error ?? 'Unknown error';
          history.push(`Observation: ${observation}`);
          prompt += `\n\n${response.text}\nObservation: ${observation}`;
          this.#eventBus?.emit('onToolResult', { tool: parsed.action, result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          history.push(`Observation: Error — ${msg}`);
          prompt += `\n\n${response.text}\nObservation: Error — ${msg}`;
          this.#eventBus?.emit('onError', { tool: parsed.action, error: msg });
        }
      }
    }

    throw new LQiaoError(
      ERROR_TYPES.MAX_STEPS,
      `Exceeded maximum steps (${this.#maxSteps})`,
    );
  }

  /** Parse model response into thought/action/answer */
  #parseResponse(text: string): ParsedAction {
    const result: ParsedAction = {};

    const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n|$)/i);
    if (thoughtMatch) result.thought = thoughtMatch[1].trim();

    const actionMatch = text.match(/Action:\s*(.+?)(?=\n|$)/i);
    if (actionMatch) result.action = actionMatch[1].trim();

    const inputMatch = text.match(/Action Input:\s*(.+?)(?=\n|$)/i);
    if (inputMatch) {
      try {
        result.args = JSON.parse(inputMatch[1].trim());
      } catch {
        result.args = { raw: inputMatch[1].trim() };
      }
    }

    const answerMatch = text.match(/Final Answer:\s*(.+)$/i);
    if (answerMatch) result.finalAnswer = answerMatch[1].trim();

    return result;
  }
}
