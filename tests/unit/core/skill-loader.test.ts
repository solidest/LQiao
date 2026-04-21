import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock('node:path', () => ({
  resolve: vi.fn((...parts: string[]) => parts.join('/')),
}));

import { loadSkills } from '../../../src/core/skill-loader';

const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

const validSkillConfig = {
  name: 'test-skill',
  description: 'A test skill',
  prompt: 'Do something useful',
  enabled: true,
};

describe('SkillLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load skill from inline config', () => {
    const skills = loadSkills([validSkillConfig]);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].description).toBe('A test skill');
    expect(skills[0].prompt).toBe('Do something useful');
    expect(skills[0].enabled).toBe(true);
    expect(skills[0].tools).toEqual([]);
  });

  it('should default enabled to true when not specified', () => {
    const skills = loadSkills([{
      name: 'disabled-skill',
      description: 'No enabled flag',
      prompt: 'Some prompt',
    }]);

    expect(skills[0].enabled).toBe(true);
  });

  it('should trim whitespace from name, description, and prompt', () => {
    const skills = loadSkills([{
      name: '  trim-me  ',
      description: '  desc  ',
      prompt: '  prompt  ',
    }]);

    expect(skills[0].name).toBe('trim-me');
    expect(skills[0].description).toBe('desc');
    expect(skills[0].prompt).toBe('prompt');
  });

  it('should throw when skill name is empty', () => {
    expect(() => loadSkills([{
      name: '',
      description: 'desc',
      prompt: 'prompt',
    }])).toThrow('Skill name is required');
  });

  it('should throw when skill description is empty', () => {
    expect(() => loadSkills([{
      name: 'test',
      description: '',
      prompt: 'prompt',
    }])).toThrow('Skill "test": description is required');
  });

  it('should throw when skill prompt is empty', () => {
    expect(() => loadSkills([{
      name: 'test',
      description: 'desc',
      prompt: '',
    }])).toThrow('Skill "test": prompt is required');
  });

  it('should load multiple skills from inline configs', () => {
    const skills = loadSkills([
      { name: 'skill-a', description: 'desc a', prompt: 'prompt a' },
      { name: 'skill-b', description: 'desc b', prompt: 'prompt b' },
    ]);

    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe('skill-a');
    expect(skills[1].name).toBe('skill-b');
  });

  it('should load skill from file path', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(validSkillConfig));

    const skills = loadSkills(['/path/to/skill.json']);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
    expect(mockExistsSync).toHaveBeenCalledWith('/path/to/skill.json');
    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/skill.json', 'utf-8');
  });

  it('should throw when skill file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => loadSkills(['/nonexistent/skill.json']))
      .toThrow('Skill file not found: /nonexistent/skill.json');
  });

  it('should resolve file path with baseDir', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(validSkillConfig));

    loadSkills(['skill.json'], '/base/dir');

    expect(mockExistsSync).toHaveBeenCalledWith('/base/dir/skill.json');
  });

  it('should load mixed inline and file-based skills', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(validSkillConfig));

    const skills = loadSkills([
      { name: 'inline', description: 'inline desc', prompt: 'inline prompt' },
      '/path/to/file.json',
    ]);

    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe('inline');
    expect(skills[1].name).toBe('test-skill');
  });

  it('should preserve tools from config', () => {
    const mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      execute: vi.fn(),
    };

    const skills = loadSkills([{
      name: 'tool-skill',
      description: 'Has tools',
      prompt: 'prompt',
      tools: [mockTool],
    }]);

    expect(skills[0].tools).toHaveLength(1);
    expect(skills[0].tools[0].name).toBe('test-tool');
  });
});
