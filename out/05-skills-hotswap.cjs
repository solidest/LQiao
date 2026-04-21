/**
 * 示例五：Skills 运行时热更新 — 动态加载/卸载技能 + 工具热替换
 *
 * 场景：运维 Agent 初始只有基础文件操作能力，运行时动态加载
 * "日志分析"技能、热替换工具、更新配置，展示完整的 Skill + Tool
 * 生命周期管理。
 *
 * 覆盖功能：
 *   - v1.3: SkillRegistry, loadSkills, SkillConfig
 *   - v1.5: Agent.addSkill, Agent.removeSkill, Agent.enableSkill,
 *           Agent.disableSkill, Agent.addTool, Agent.removeTool,
 *           Agent.updateConfig, Agent.updateSandbox, Agent.switchModel,
 *           Agent.getSkills, Agent.clearTools
 *   - 事件: onSkillLoaded, onSkillEnabled, onToolUpdated, onToolRemoved
 *
 * 运行方式：从项目根目录执行  node out/05-skills-hotswap.cjs
 */

const {
  Agent, ReactAgent, FileTool, GitTool, Sandbox, DefaultEventBus,
  SkillRegistry,
  Logger, Profiler,
} = require('../dist/cjs/index.cjs');
const { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } = require('fs');
const { join } = require('path');

// ─── 准备工作：创建模拟项目 ───────────────────────────────────────
const PROJECT = join(__dirname, 'fixtures-skills');
const LOG_DIR = join(PROJECT, 'logs');
mkdirSync(LOG_DIR, { recursive: true });
writeFileSync(join(LOG_DIR, 'app.log'), [
  '2026-04-21T08:00:01Z INFO  Server started',
  '2026-04-21T08:01:12Z ERROR [DatabaseError] Connection pool exhausted',
  '2026-04-21T08:02:00Z WARN  High memory usage: 85%',
  '2026-04-21T08:03:01Z ERROR [TimeoutError] Request timed out',
].join('\n'), 'utf-8');

// ─── 辅助工具 ─────────────────────────────────────────────────────
const sandbox = new Sandbox({ allowedPaths: [PROJECT] });
const eventBus = new DefaultEventBus();
const logger = new Logger({ level: 'info', verbose: true });
const profiler = new Profiler();

// 监听所有 Agent 事件
const eventLog = [];
eventBus.on('onToolCall', (d) => { eventLog.push(`toolCall:${d.tool}`); });
eventBus.on('onToolUpdated', (d) => { eventLog.push(`toolUpdated:${d.name}`); });
eventBus.on('onToolRemoved', (d) => { eventLog.push(`toolRemoved:${d.name}`); });
eventBus.on('onToolRegistered', (d) => { eventLog.push(`toolRegistered:${d.name}`); });
eventBus.on('onSkillLoaded', (d) => { eventLog.push(`skillLoaded:${d.name}`); });
eventBus.on('onSkillEnabled', (d) => { eventLog.push(`skillEnabled:${d.name}`); });
eventBus.on('onSkillDisabled', (d) => { eventLog.push(`skillDisabled:${d.name}`); });

// Mock model generator
function createMockModel(responses) {
  let idx = 0;
  return {
    async generate() {
      const resp = responses[idx] ?? responses[responses.length - 1];
      idx++;
      if (typeof resp === 'function') return resp();
      return { text: resp, usage: { promptTokens: 100, completionTokens: 50 }, stopReason: 'stop' };
    },
    async *stream() { yield { text: 'ok', done: true }; },
  };
}

// ─── 运行 ─────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例五：Skills 运行时热更新');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 阶段 1：创建基础 Agent ────────────────────────────────────
  console.log('━━━ 阶段 1：创建基础 Agent（只有文件操作） ━━━\n');

  profiler.start('agent-create');

  const agent = new Agent({
    model: 'gpt-4o',
    apiKey: 'mock-key',
    tools: [new FileTool(sandbox)],
    eventBus,
    sandbox,
    maxSteps: 20,
    maxRetries: 3,
    verbose: true,
  });

  console.log(`  🤖 Agent 创建完成`);
  console.log(`  📋 初始工具数: ${agent.config.tools?.length ?? 1}`);
  console.log(`  📋 最大步数: ${agent.config.maxSteps}`);
  console.log(`  📋 Skills: ${agent.getSkills().length}`);

  profiler.stop('agent-create');

  // ── 阶段 2：运行时添加 Skill ──────────────────────────────────
  console.log('\n━━━ 阶段 2：动态加载 "日志分析" 技能 ━━━\n');

  // 定义一个日志分析 Skill
  const logAnalysisSkill = {
    name: 'log-analyzer',
    description: 'Analyze log files for errors and patterns',
    prompt: 'You are a log analysis expert. Look for ERROR/WARN patterns.',
    tools: [
      {
        name: 'log_reader',
        description: 'Read and parse log files',
        version: '1.0.0',
        metadata: { category: 'logs' },
        execute: async (...args) => {
          const path = args[0]?.path ?? args[0];
          if (!path || !existsSync(path)) {
            return { success: false, error: 'File not found' };
          }
          const content = readFileSync(path, 'utf-8');
          const lines = content.split('\n').filter(Boolean);
          const errors = lines.filter(l => l.includes('ERROR'));
          const warns = lines.filter(l => l.includes('WARN'));
          return {
            success: true,
            data: { total: lines.length, errors: errors.length, warns: warns.length, errorLines: errors },
          };
        },
      },
    ],
  };

  agent.addSkill(logAnalysisSkill);

  console.log(`  ✅ 已添加 skill: log-analyzer`);
  console.log(`  📋 当前 skills: ${agent.getSkills().map(s => s.name).join(', ')}`);
  console.log(`  📋 工具数: ${agent.config.tools?.length ?? 1}`);

  // ── 阶段 3：Skill 生命周期操作 ─────────────────────────────────
  console.log('\n━━━ 阶段 3：Skill 启用/禁用/移除 ━━━\n');

  agent.disableSkill('log-analyzer');
  console.log(`  ⏸️  已禁用 skill: log-analyzer`);

  agent.enableSkill('log-analyzer');
  console.log(`  ▶️  已启用 skill: log-analyzer`);

  agent.removeSkill('log-analyzer');
  console.log(`  🗑️  已移除 skill: log-analyzer`);
  console.log(`  📋 剩余 skills: ${agent.getSkills().map(s => s.name).join(', ') || '(无)'}`);

  // ── 阶段 4：运行时工具热替换 ──────────────────────────────────
  console.log('\n━━━ 阶段 4：工具热替换 ━━━\n');

  // 添加 GitTool
  agent.addTool(new GitTool(sandbox, PROJECT));
  console.log(`  ➕ 已添加工具: git`);

  // 添加一个自定义工具
  agent.addTool({
    name: 'time_check',
    description: 'Returns current timestamp',
    version: '1.0.0',
    execute: async () => ({ success: true, data: { now: Date.now() } }),
  });
  console.log(`  ➕ 已添加工具: time_check`);

  // 替换 file 工具（添加新版本）
  agent.addTool({
    name: 'file',
    description: 'File operations v2 (enhanced)',
    version: '2.0.0',
    execute: async () => ({ success: true, data: {} }),
  });
  console.log(`  🔄 已替换工具: file → v2.0.0`);

  // 移除 time_check
  agent.removeTool('time_check');
  console.log(`  ➖ 已移除工具: time_check`);

  // ── 阶段 5：配置热更新 ────────────────────────────────────────
  console.log('\n━━━ 阶段 5：配置热更新 ━━━\n');

  agent.updateConfig({ maxSteps: 30, maxRetries: 5, verbose: false });
  console.log(`  ⚙️  maxSteps → 30, maxRetries → 5, verbose → false`);
  console.log(`  📋 当前 maxSteps: ${agent.config.maxSteps}`);
  console.log(`  📋 当前 maxRetries: ${agent.config.maxRetries}`);

  agent.switchModel('claude-sonnet-4-6', 'new-api-key');
  console.log(`  🔄 模型切换: gpt-4o → claude-sonnet-4-6`);
  console.log(`  📋 当前 model: ${agent.config.model}`);

  // ── 阶段 6：清空并重置 ────────────────────────────────────────
  console.log('\n━━━ 阶段 6：清空工具与重建 ━━━\n');

  agent.clearTools();
  console.log(`  🧹 已清空所有工具和 skills`);
  console.log(`  📋 工具数: ${agent.config.tools?.length ?? 0}`);
  console.log(`  📋 Skills: ${agent.getSkills().length}`);

  // ── 阶段 7：运行 ReactAgent（验证重建后的 Agent 仍可用） ──────
  console.log('\n━━━ 阶段 7：验证 Agent 可执行 ━━━\n');

  agent.addTool(new FileTool(sandbox));

  const { generate } = createMockModel([
    'Thought: 读取日志文件\nAction: file\nAction Input: {"action": "read", "path": "' + join(LOG_DIR, 'app.log') + '"}',
    'Thought: 日志中有 2 条 ERROR\nFinal Answer: 日志分析完成，发现 2 条错误。',
  ]);

  const reactAgent = new ReactAgent({
    tools: agent.config.tools,
    eventBus,
    maxSteps: agent.config.maxSteps ?? 20,
    maxRetries: agent.config.maxRetries ?? 3,
    sandbox,
  });

  const result = await reactAgent.run(generate, '分析日志文件中的错误');
  console.log(`  📋 Agent 执行结果: ${result}`);

  // ── 汇总 ──────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 事件日志:', eventLog.join(', '));

  const timingRecords = profiler.getRecords();
  console.log('📊 性能记录:');
  for (const r of timingRecords) {
    console.log(`   ${r.name}: ${r.duration.toFixed(2)}ms`);
  }

  // 清理
  rmSync(PROJECT, { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  示例五执行完成');
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(PROJECT, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
