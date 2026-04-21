import { Sandbox } from '../security/sandbox';
import type { GenerateOptions, ModelResponse } from '../types/model';
import { LQiaoError, ERROR_TYPES } from '../types/error';

/** Code execution result */
export interface CodeExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/** Code block extracted from LLM response */
export interface CodeBlock {
  language: string;
  code: string;
}

/**
 * CodeAgent — parses and executes code from LLM output.
 */
export class CodeAgent {
  #sandbox: Sandbox;

  constructor(sandbox?: Sandbox) {
    this.#sandbox = sandbox ?? new Sandbox();
  }

  /**
   * Extract code blocks from LLM response text.
   * Supports ```lang ... ``` and ` ... ` formats.
   */
  extractCode(text: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];

    // Match fenced code blocks: ```lang ... ```
    const fenceRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] ?? 'javascript',
        code: match[2].trim(),
      });
    }

    // If no fenced blocks found, treat entire text as code if it looks like code
    if (blocks.length === 0 && /\b(function|const|let|var|return|import|export)\b/.test(text)) {
      blocks.push({ language: 'javascript', code: text.trim() });
    }

    return blocks;
  }

  /**
   * Execute extracted code blocks through sandbox.
   */
  async executeFromResponse(response: string): Promise<CodeExecutionResult[]> {
    const blocks = this.extractCode(response);
    if (blocks.length === 0) {
      return [{ success: false, error: 'No code blocks found in response' }];
    }

    const results: CodeExecutionResult[] = [];
    for (const block of blocks) {
      results.push(await this.executeCode(block.code));
    }
    return results;
  }

  /**
   * Execute a code string through the sandbox.
   */
  async executeCode(code: string): Promise<CodeExecutionResult> {
    try {
      const output = await this.#sandbox.executeCode(code);
      return { success: true, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Run with model: generate → extract → execute → return.
   */
  async runWithModel(
    generate: (prompt: string, options?: GenerateOptions) => Promise<ModelResponse>,
    task: string,
  ): Promise<CodeExecutionResult[]> {
    const prompt = `Write JavaScript/TypeScript code to accomplish: ${task}\n\nWrap your code in \`\`\`javascript blocks.`;

    const response = await generate(prompt);
    return this.executeFromResponse(response.text);
  }
}
