/**
 * 示例一：代码运维智能体 — 自动定位 Bug、修复并提交
 *
 * 场景：项目中有一个带 bug 的 server.ts，async 请求处理缺少 try/catch，
 * 未捕获异常会导致服务崩溃。让 Agent 自动读取、修复、写回并提交 git。
 *
 * 运行方式：从项目根目录执行  node out/01-code-ops-agent.cjs
 */

const { ReactAgent, FileTool, GitTool, Sandbox, DefaultEventBus } = require('../dist/cjs/index.cjs');
const { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } = require('fs');
const { join } = require('path');

// ─── 准备工作：创建一个带 bug 的模拟项目 ──────────────────────────
const PROJECT = join(__dirname, 'fixtures', 'project');
const SRC_DIR = join(PROJECT, 'src');
const SERVER_FILE = join(SRC_DIR, 'server.ts');

mkdirSync(SRC_DIR, { recursive: true });

// 带 bug 的源码：async 请求处理缺少 try/catch
writeFileSync(SERVER_FILE, [
  "import http from 'http';",
  '',
  'const server = http.createServer(async (req, res) => {',
  "  if (req.url === '/api/data') {",
  '    const data = await fetchData();',
  '    res.writeHead(200);',
  '    res.end(JSON.stringify(data));',
  '  }',
  '});',
  '',
  'server.listen(3000);',
  '',
  'async function fetchData() {',
  '  return { items: [1, 2, 3] };',
  '}',
].join('\n'), 'utf-8');

// 初始化 git repo（git commit 需要）
const { execSync } = require('child_process');
try {
  execSync('git init', { cwd: PROJECT, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: PROJECT, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: PROJECT, stdio: 'pipe' });
} catch { /* already exists */ }

console.log('📄 已创建带 bug 的模拟文件: src/server.ts');
console.log('   Bug: async 请求处理缺少 try/catch，未捕获异常会导致服务崩溃\n');

// ─── 沙箱：限制 Agent 只能操作项目目录 ────────────────────────────
const sandbox = new Sandbox({
  allowedPaths: [PROJECT],
  timeout: 10000,
});

// ─── 事件总线：监听所有 Agent 操作 ────────────────────────────────
const eventBus = new DefaultEventBus();
const callLog = [];

eventBus.on('onToolCall', (data) => {
  callLog.push({ event: 'toolCall', tool: data.tool, args: data.args });
  console.log(`  🔧 调用工具: ${data.tool}`);
  console.log(`     参数:`, JSON.stringify(data.args).slice(0, 120));
});

eventBus.on('onToolResult', (data) => {
  callLog.push({ event: 'toolResult', tool: data.tool, success: data.result?.success });
  if (data.result?.success) {
    const preview = JSON.stringify(data.result.data).slice(0, 80);
    console.log(`  ✅ 工具返回: ${preview}`);
  } else {
    console.log(`  ❌ 工具失败: ${data.result?.error?.slice(0, 100)}`);
  }
});

eventBus.on('onStep', (data) => {
  console.log(`  💡 第 ${data.step + 1} 步推理完成`);
});

// ─── 模拟模型响应 ─────────────────────────────────────────────────
/**
 * 模拟模型按预设步骤返回 ReAct 格式响应。
 * 实际使用时替换为真实的 OpenAI/Anthropic API 调用。
 */
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

// 定义 ReAct 推理步骤（模拟 LLM 的行为）
const mockSteps = [
  // 步骤 1：读取文件
  `Thought: 我需要先读取 src/server.ts 来分析代码中的 bug
Action: file
Action Input: {"action": "read", "path": ${JSON.stringify(SERVER_FILE)}}`,

  // 步骤 2：分析后写入修复
  function (prompt) {
    const fixedCode = [
      "import http from 'http';",
      '',
      'const server = http.createServer(async (req, res) => {',
      '  try {',
      "    if (req.url === '/api/data') {",
      '      const data = await fetchData();',
      "      res.writeHead(200, { 'Content-Type': 'application/json' });",
      '      res.end(JSON.stringify(data));',
      '    }',
      '  } catch (error) {',
      '    res.writeHead(500);',
      "    res.end(JSON.stringify({ error: 'Internal server error' }));",
      '  }',
      '});',
      '',
      'server.listen(3000);',
      '',
      'async function fetchData() {',
      '  return { items: [1, 2, 3] };',
      '}',
    ].join('\n');
    return {
      text: `Thought: 我发现 async 请求处理缺少 try/catch。需要添加全局错误处理器。
Action: file
Action Input: {"action": "write", "path": ${JSON.stringify(SERVER_FILE)}, "content": ${JSON.stringify(fixedCode)}}`,
      usage: { promptTokens: 200, completionTokens: 100 },
      stopReason: 'stop',
    };
  },

  // 步骤 3：git add
  `Thought: 文件已修复，现在需要暂存更改
Action: git
Action Input: {"action": "add", "paths": ["src/server.ts"]}`,

  // 步骤 4：git commit
  `Thought: 文件已暂存，现在提交更改
Action: git
Action Input: {"action": "commit", "message": "fix: 添加全局错误处理器，防止未捕获异常"}`,

  // 步骤 5：最终答案
  `Thought: 所有操作已完成
Final Answer: 已完成 bug 修复并提交。修复内容：在请求处理函数中添加 try/catch，捕获异常后返回 500 状态码。`,
];

// ─── 运行 Agent ───────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例一：代码运维智能体');
  console.log('═══════════════════════════════════════════════════\n');

  const { generate } = createMockModel(mockSteps);

  const agent = new ReactAgent({
    tools: [new FileTool(sandbox), new GitTool(sandbox, PROJECT)],
    eventBus,
    maxSteps: 10,
    maxRetries: 2,
    sandbox,
  });

  const result = await agent.run(generate, '读取 src/server.ts，定位 bug，修复代码并提交到 git');

  console.log('\n───────────────────────────────────────────────────');
  console.log('📋 最终结果:', result);

  // 验证修复后的文件
  const fixedContent = readFileSync(SERVER_FILE, 'utf-8');
  console.log('\n📄 修复后的文件内容:');
  console.log('───────────────────────────────────────────────────');
  console.log(fixedContent);
  console.log('───────────────────────────────────────────────────');

  // 验证 git 提交记录
  try {
    const log = execSync('git log --oneline -1', { cwd: PROJECT, encoding: 'utf-8' }).trim();
    console.log(`\n📝 Git 提交记录: ${log}`);
  } catch {
    console.log('\n⚠️  未能获取 git log（非关键）');
  }

  // 统计
  const successes = callLog.filter(c => c.event === 'toolResult' && c.success);
  console.log(`\n📊 工具调用成功率: ${successes.length}/${callLog.filter(c => c.event === 'toolResult').length}`);

  // 清理
  rmSync(join(PROJECT, '..'), { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(join(PROJECT, '..'), { recursive: true, force: true }); } catch {}
  process.exit(1);
});
