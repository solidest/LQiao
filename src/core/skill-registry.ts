import type { Skill, SkillConfig } from '../types/skill';
import type { Tool } from '../types/tool';
import type { EventBus } from '../types/event';
import { loadSkills } from './skill-loader';

/** Manages skill lifecycle: register, enable/disable, remove, and aggregate */
export class SkillRegistry {
  #skills: Map<string, Skill> = new Map();
  #eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    this.#eventBus = eventBus;
  }

  /** Register a skill from config or file path */
  register(config: SkillConfig | string, baseDir?: string): void {
    if (typeof config === 'string') {
      const skills = loadSkills([config], baseDir);
      this.#registerSkill(skills[0]);
    } else {
      const skill = loadSkills([config])[0];
      this.#registerSkill(skill);
    }
  }

  #registerSkill(skill: Skill): void {
    if (this.#skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`);
    }
    this.#skills.set(skill.name, skill);
    this.#eventBus?.emit('onSkillLoaded', { name: skill.name });
  }

  /** Enable a previously registered skill */
  enable(name: string): void {
    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" is not registered`);
    }
    if (!skill.enabled) {
      skill.enabled = true;
      this.#eventBus?.emit('onSkillEnabled', { name });
    }
  }

  /** Disable a registered skill */
  disable(name: string): void {
    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" is not registered`);
    }
    if (skill.enabled) {
      skill.enabled = false;
      this.#eventBus?.emit('onSkillDisabled', { name });
    }
  }

  /** Remove a skill entirely from the registry */
  remove(name: string): void {
    this.#skills.delete(name);
  }

  /** Get a skill by name */
  get(name: string): Skill | undefined {
    return this.#skills.get(name);
  }

  /** List all registered skills */
  list(): Skill[] {
    return Array.from(this.#skills.values());
  }

  /** Get all tools from enabled skills */
  getEnabledTools(): Tool[] {
    return Array.from(this.#skills.values())
      .filter((s) => s.enabled)
      .flatMap((s) => s.tools);
  }

  /** Concatenate system prompts from all enabled skills */
  getEnabledPrompts(): string {
    return Array.from(this.#skills.values())
      .filter((s) => s.enabled)
      .map((s) => `--- Skill: ${s.name} ---\n${s.prompt}`)
      .join('\n\n');
  }
}
