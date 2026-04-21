import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SkillConfig, Skill } from '../types/skill';

/** Load a single skill from inline config or file path */
function loadSkill(input: SkillConfig | string, baseDir?: string): Skill {
  if (typeof input === 'string') {
    const path = baseDir ? resolve(baseDir, input) : resolve(input);
    if (!existsSync(path)) {
      throw new Error(`Skill file not found: ${path}`);
    }
    const raw = readFileSync(path, 'utf-8');
    let config: SkillConfig;
    try {
      config = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON in skill file: ${path}`);
    }
    return normalizeSkill(config);
  }
  return normalizeSkill(input);
}

/** Load multiple skills from mixed input (configs or file paths) */
export function loadSkills(
  inputs: Array<SkillConfig | string>,
  baseDir?: string,
): Skill[] {
  return inputs.map((input) => loadSkill(input, baseDir));
}

/** Validate and normalize a SkillConfig into a Skill */
function normalizeSkill(config: SkillConfig): Skill {
  if (!config.name || config.name.trim().length === 0) {
    throw new Error('Skill name is required');
  }
  if (!config.description || config.description.trim().length === 0) {
    throw new Error(`Skill "${config.name}": description is required`);
  }
  if (!config.prompt || config.prompt.trim().length === 0) {
    throw new Error(`Skill "${config.name}": prompt is required`);
  }
  return {
    name: config.name.trim(),
    description: config.description.trim(),
    prompt: config.prompt.trim(),
    tools: config.tools ?? [],
    enabled: config.enabled ?? true,
  };
}
