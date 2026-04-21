import { ERROR_TYPES, LQiaoError } from '../types/error';
import type { SandboxConfig } from '../types/agent';
import vm from 'node:vm';
import { resolve, relative, isAbsolute } from 'node:path';

/**
 * Sandbox for file system and code execution isolation.
 * - File sandbox: restricts file access to allowed paths
 * - Code sandbox: runs code in a VM with restricted globals
 */
export class Sandbox {
  #config: Required<SandboxConfig>;

  constructor(config?: SandboxConfig) {
    this.#config = {
      allowedPaths: config?.allowedPaths ?? [process.cwd()],
      blockedPaths: config?.blockedPaths ?? [],
      blockedCommands: config?.blockedCommands ?? DEFAULT_BLOCKED_COMMANDS,
      timeout: config?.timeout ?? 30000,
      memoryLimit: config?.memoryLimit ?? 256,
    };
  }

  /**
   * Validate that a file path is within allowed boundaries.
   * Throws SANDBOX_VIOLATION if the path is blocked or outside allowed paths.
   */
  validatePath(filePath: string): string {
    const normalized = resolve(filePath);

    // Check blacklist
    for (const blocked of this.#config.blockedPaths) {
      if (isPathUnder(normalized, resolve(blocked))) {
        throw new LQiaoError(
          ERROR_TYPES.SANDBOX_VIOLATION,
          `Access to path blocked: ${filePath}`,
        );
      }
    }

    // Check whitelist (must be under at least one allowed path)
    const isAllowed = this.#config.allowedPaths.some((allowed) =>
      isPathUnder(normalized, resolve(allowed)),
    );
    if (!isAllowed) {
      throw new LQiaoError(
        ERROR_TYPES.SANDBOX_VIOLATION,
        `Path outside allowed directories: ${filePath}`,
      );
    }

    return normalized;
  }

  /**
   * Execute code in an isolated VM context.
   * Blocks `require`, `import`, `process`, and network APIs.
   */
  async executeCode(code: string): Promise<unknown> {
    const context: Record<string, unknown> = {
      console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {} },
      setTimeout: undefined,
      setInterval: undefined,
      require: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
      module: undefined,
      exports: undefined,
      __filename: undefined,
      __dirname: undefined,
    };

    const wrapped = `(function() { ${code} })()`;
    const script = new vm.Script(wrapped);

    return script.runInNewContext(context, {
      timeout: this.#config.timeout,
      microtaskMode: 'afterEvaluate',
    });
  }

  /** Check if a command is blocked */
  isCommandBlocked(cmd: string): boolean {
    const normalized = cmd.trim().toLowerCase();
    return this.#config.blockedCommands.some(
      (blocked) => normalized === blocked || normalized.startsWith(blocked + ' '),
    );
  }

  get config(): Readonly<SandboxConfig> {
    return { ...this.#config };
  }
}

const DEFAULT_BLOCKED_COMMANDS = [
  'rm -rf',
  'rm -r',
  'del /s',
  'rmdir /s',
  'format',
  'shutdown',
  'reboot',
];

/** Check if `child` is under `parent` in the file system */
function isPathUnder(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return !rel.startsWith('..') && !isAbsolute(rel);
}
