/**
 * 示例二：日志分析智能体 — 自动读取日志、统计错误、生成报告
 *
 * 场景：模拟生产环境日志文件，让 Agent 读取日志、统计 ERROR 级别条目、
 * 按错误类型分类，并生成结构化分析报告。
 *
 * 运行方式：从项目根目录执行  node out/02-log-analysis-agent.cjs
 */

const { ReactAgent, FileTool, Sandbox, DefaultEventBus } = require('../dist/cjs/index.cjs');
const { mkdirSync, writeFileSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

// ─── 准备工作：创建模拟日志文件 ──────────────────────────────────
const PROJECT = join(__dirname, 'fixtures-log');
const LOG_DIR = join(PROJECT, 'logs');
const LOG_FILE = join(LOG_DIR, 'app.log');
const REPORT_FILE = join(PROJECT, 'report', 'error-analysis.md');

mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(join(PROJECT, 'report'), { recursive: true });

// 模拟生产日志：包含 INFO、WARN、ERROR 多种级别和错误类型
const logLines = [
  '2026-04-21T08:00:01Z INFO  Server started on port 3000',
  '2026-04-21T08:01:12Z INFO  GET /api/users 200 45ms',
  '2026-04-21T08:02:33Z ERROR [DatabaseError] Connection pool exhausted',
  '2026-04-21T08:03:01Z WARN  High memory usage: 85%',
  '2026-04-21T08:04:15Z ERROR [TimeoutError] Request to /api/orders timed out after 30s',
  '2026-04-21T08:05:00Z INFO  GET /api/health 200 2ms',
  '2026-04-21T08:06:22Z ERROR [DatabaseError] Connection pool exhausted',
  '2026-04-21T08:07:10Z ERROR [AuthError] Invalid token for user admin',
  '2026-04-21T08:08:45Z INFO  POST /api/login 200 120ms',
  '2026-04-21T08:09:33Z ERROR [TimeoutError] Request to /api/reports timed out after 30s',
  '2026-04-21T08:10:01Z ERROR [DatabaseError] Connection refused to replica-02',
  '2026-04-21T08:11:15Z WARN  Slow query detected: 2500ms',
  '2026-04-21T08:12:00Z ERROR [AuthError] Expired token for user editor',
  '2026-04-21T08:13:22Z INFO  GET /api/products 200 30ms',
  '2026-04-21T08:14:45Z ERROR [TimeoutError] Request to /api/dashboard timed out after 30s',
  '2026-04-21T08:15:01Z ERROR [DatabaseError] Connection pool exhausted',
  '2026-04-21T08:16:30Z INFO  Background job completed: cleanup_sessions',
  '2026-04-21T08:17:12Z ERROR [NetworkError] Failed to connect to cache server redis-01',
  '2026-04-21T08:18:00Z ERROR [AuthError] Invalid token for user viewer',
  '2026-04-21T08:19:22Z ERROR [DatabaseError] Connection pool exhausted',
].join('\n');

writeFileSync(LOG_FILE, logLines, 'utf-8');
console.log('📄 已创建模拟日志文件: logs/app.log');
console.log(`   共 ${logLines.split('\n').length} 行日志条目\n`);

// ─── 沙箱：允许操作 logs/ 和 report/ 目录 ─────────────────────────
const sandbox = new Sandbox({
  allowedPaths: [PROJECT],
  timeout: 10000,
});

// ─── 事件总线：监听 Agent 操作 ────────────────────────────────────
const eventBus = new DefaultEventBus();

eventBus.on('onToolCall', (data) => {
  console.log(`  🔧 调用工具: ${data.tool}`);
  if (data.tool === 'file' && data.args?.action) {
    console.log(`     操作: ${data.args.action}, 路径: ${data.args.path?.replace(PROJECT, '.')}`);
  }
});

eventBus.on('onToolResult', (data) => {
  if (data.result?.success) {
    console.log(`  ✅ 成功`);
  } else {
    console.log(`  ❌ 失败: ${data.result?.error?.slice(0, 80)}`);
  }
});

eventBus.on('onStep', (data) => {
  console.log(`  💡 第 ${data.step + 1} 步推理完成`);
});

// ─── 模拟模型响应 ─────────────────────────────────────────────────
function createMockModel(steps) {
  let index = 0;
  return {
    async generate(prompt) {
      const step = steps[index] ?? steps[steps.length - 1];
      index++;
      if (typeof step === 'function') {
        return step(prompt);
      }
      return {
        text: step,
        usage: { promptTokens: 100, completionTokens: 50 },
        stopReason: 'stop',
      };
    },
    async *stream() {
      yield { text: 'streamed', done: true };
    },
  };
}

// 定义 ReAct 推理步骤
const mockSteps = [
  // 步骤 1：读取日志文件
  `Thought: 我需要先读取日志文件来分析内容
Action: file
Action Input: {"action": "read", "path": ${JSON.stringify(LOG_FILE)}}`,

  // 步骤 2：分析后生成报告并写入
  function (prompt) {
    const report = [
      '# 错误分析报告',
      '',
      '## 错误总览',
      '',
      `- 总错误数：12`,
      `- 日志总行数：20`,
      `- 错误率：60%`,
      '',
      '## 最高频错误',
      '',
      '- **DatabaseError**：出现 5 次（占比 41.7%）',
      '  - Connection pool exhausted：4 次',
      '  - Connection refused：1 次',
      '',
      '## 详细分类',
      '',
      '| 错误类型 | 出现次数 | 占比 |',
      '|---------|---------|------|',
      '| DatabaseError | 5 | 41.7% |',
      '| TimeoutError | 3 | 25.0% |',
      '| AuthError | 3 | 25.0% |',
      '| NetworkError | 1 | 8.3% |',
      '',
      '## 建议',
      '',
      '1. 优先排查数据库连接池问题（最高频）',
      '2. 检查超时接口的性能瓶颈',
      '3. 审查 Token 过期策略',
    ].join('\n');
    return {
      text: `Thought: 我已读取日志，现在统计 ERROR 条目并生成报告
Action: file
Action Input: {"action": "write", "path": ${JSON.stringify(REPORT_FILE)}, "content": ${JSON.stringify(report)}}`,
      usage: { promptTokens: 300, completionTokens: 150 },
      stopReason: 'stop',
    };
  },

  // 步骤 3：读取生成的报告
  `Thought: 报告已写入，现在读取完整报告返回给用户
Action: file
Action Input: {"action": "read", "path": ${JSON.stringify(REPORT_FILE)}}`,

  // 步骤 4：最终答案
  `Thought: 我已读取了分析报告
Final Answer: 日志分析完成。共发现 12 条 ERROR，最高频错误为 DatabaseError（5 次，占 41.7%），主要原因为连接池耗尽。详细报告已写入 report/error-analysis.md。`,
];

// ─── 运行 Agent ───────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例二：日志分析智能体');
  console.log('═══════════════════════════════════════════════════\n');

  const { generate } = createMockModel(mockSteps);

  const agent = new ReactAgent({
    tools: [new FileTool(sandbox)],
    eventBus,
    maxSteps: 10,
    maxRetries: 2,
    sandbox,
  });

  const result = await agent.run(generate, `
    1. 读取 ${LOG_FILE.replace(PROJECT, '.')} 文件
    2. 统计所有 ERROR 级别的日志条目
    3. 按错误类型分类（提取方括号中的错误类型）
    4. 找出出现频率最高的 3 种错误
    5. 将分析报告写入 ${REPORT_FILE.replace(PROJECT, '.')}
  `);

  console.log('\n───────────────────────────────────────────────────');
  console.log('📋 最终结果:', result);

  // 验证报告文件
  const reportContent = readFileSync(REPORT_FILE, 'utf-8');
  console.log('\n📄 生成的分析报告:');
  console.log('───────────────────────────────────────────────────');
  console.log(reportContent);
  console.log('───────────────────────────────────────────────────');

  // 清理
  rmSync(PROJECT, { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(PROJECT, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
