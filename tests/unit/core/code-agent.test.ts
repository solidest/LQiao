import { describe, it, expect } from 'vitest';
import { CodeAgent } from '../../../src/core/code-agent';
import type { ModelResponse } from '../../../src/types/model';

describe('CodeAgent', () => {
  describe('extractCode', () => {
    it('should extract fenced code blocks', () => {
      const agent = new CodeAgent();
      const blocks = agent.extractCode('Here is the code:\n```javascript\nconst x = 1 + 2;\n```\nDone.');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].code).toBe('const x = 1 + 2;');
    });

    it('should extract multiple code blocks', () => {
      const agent = new CodeAgent();
      const blocks = agent.extractCode('```\nconst a = 1;\n```\nAnd also:\n```python\nprint("hi")\n```');
      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[1].language).toBe('python');
    });

    it('should treat raw text as code when no fences found', () => {
      const agent = new CodeAgent();
      const blocks = agent.extractCode('const result = 2 * 3;');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
    });

    it('should return empty for non-code text', () => {
      const agent = new CodeAgent();
      const blocks = agent.extractCode('Hello world, this is just text.');
      expect(blocks).toHaveLength(0);
    });
  });

  describe('executeCode', () => {
    it('should execute simple expressions', async () => {
      const agent = new CodeAgent();
      const result = await agent.executeCode('return 2 + 3;');
      expect(result.success).toBe(true);
      expect(result.output).toBe(5);
    });

    it('should handle execution errors', async () => {
      const agent = new CodeAgent();
      const result = await agent.executeCode('return nonexistent();');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeFromResponse', () => {
    it('should extract and execute code from response', async () => {
      const agent = new CodeAgent();
      const results = await agent.executeFromResponse(
        'Here is the code:\n```javascript\nreturn 10 * 10;\n```',
      );
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe(100);
    });

    it('should return error for no code blocks', async () => {
      const agent = new CodeAgent();
      const results = await agent.executeFromResponse('I think the answer is 42.');
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });
});
