/**
 * 示例三：前端工程助手 — 组件生成 + 代码验证 + 使用示例
 *
 * 场景：在项目中让 Agent 生成一个 TypeScript 组件、验证代码可执行性，
 * 并生成使用示例。展示多 Agent 协作：主 Agent 负责文件操作，
 * CodeAgent 负责代码验证。
 *
 * 运行方式：从项目根目录执行  node out/03-frontend-assistant.cjs
 */

const { ReactAgent, CodeAgent, FileTool, Sandbox, DefaultEventBus } = require('../dist/cjs/index.cjs');
const { mkdirSync, writeFileSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

// ─── 准备工作：创建模拟项目结构 ──────────────────────────────────
const PROJECT = join(__dirname, 'fixtures-frontend');
const SRC_DIR = join(PROJECT, 'src', 'components');

mkdirSync(SRC_DIR, { recursive: true });
console.log('📁 已创建前端项目目录结构\n');

// ─── 沙箱：限制只能操作 src/ 目录 ────────────────────────────────
const fileSandbox = new Sandbox({
  allowedPaths: [PROJECT],
  timeout: 10000,
});

const codeSandbox = new Sandbox({
  timeout: 5000,
});

// ─── 事件总线 ────────────────────────────────────────────────────
const eventBus = new DefaultEventBus();
const toolCalls = [];

eventBus.on('onToolCall', (data) => {
  toolCalls.push({ tool: data.tool, action: data.args?.action });
  console.log(`  🔧 调用工具: ${data.tool}${data.args?.action ? ` (${data.args.action})` : ''}`);
});

eventBus.on('onToolResult', (data) => {
  console.log(`  ${data.result?.success ? '✅ 成功' : '❌ 失败: ' + data.result?.error?.slice(0, 60)}`);
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

// ─── 生成组件的代码 ──────────────────────────────────────────────
const userCardCode = [
  "import React from 'react';",
  '',
  'interface UserCardProps {',
  '  name: string;',
  '  email: string;',
  '  avatar?: string;',
  '}',
  '',
  'export const UserCard: React.FC<UserCardProps> = ({ name, email, avatar }) => {',
  '  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();',
  '',
  '  return (',
  '    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, maxWidth: 300 }}>',
  '      {avatar ? (',
  '        <img src={avatar} alt={name} style={{ width: 64, height: 64, borderRadius: "50%" }} />',
  '      ) : (',
  '        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#007AFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>',
  '          {initials}',
  '        </div>',
  '      )}',
  '      <h3>{name}</h3>',
  '      <p style={{ color: "#666" }}>{email}</p>',
  '    </div>',
  '  );',
  '};',
  '',
  'export default UserCard;',
].join('\n');

const COMPONENT_FILE = join(SRC_DIR, 'UserCard.tsx');

// ─── ReAct Agent 推理步骤 ─────────────────────────────────────────
const reactSteps = [
  // 步骤 1：写入组件
  function () {
    return {
      text: `Thought: 我需要创建 UserCard 组件
Action: file
Action Input: {"action": "write", "path": ${JSON.stringify(COMPONENT_FILE)}, "content": ${JSON.stringify(userCardCode)}}`,
      usage: { promptTokens: 200, completionTokens: 150 },
      stopReason: 'stop',
    };
  },

  // 步骤 2：读取组件确认写入成功
  `Thought: 组件已写入，现在读取确认
Action: file
Action Input: {"action": "read", "path": ${JSON.stringify(COMPONENT_FILE)}}`,

  // 步骤 3：最终答案
  `Thought: 组件已成功创建
Final Answer: UserCard 组件已创建在 src/components/UserCard.tsx，包含 props 类型定义、首字母默认头像和内联样式。`,
];

// ─── 运行 ────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例三：前端工程助手');
  console.log('═══════════════════════════════════════════════════\n');

  // 任务 1：用 ReactAgent 生成组件文件
  console.log('━━━ 任务 1：生成 UserCard 组件 ━━━\n');

  const { generate: reactGenerate } = createMockModel(reactSteps);

  const agent = new ReactAgent({
    tools: [new FileTool(fileSandbox)],
    eventBus,
    maxSteps: 10,
    maxRetries: 2,
    sandbox: fileSandbox,
  });

  const result1 = await agent.run(reactGenerate, '在 src/components/ 目录下创建 UserCard.tsx 组件，包含 name、email、avatar 属性');

  console.log('\n📋 结果:', result1);

  // 任务 2：用 CodeAgent 验证生成的代码（提取可执行部分做模拟验证）
  console.log('\n━━━ 任务 2：CodeAgent 验证代码可执行性 ━━━\n');

  const codeAgent = new CodeAgent(codeSandbox);

  // 模拟验证：执行一段简单的 props 类型检查代码
  const verification = await codeAgent.executeCode(`
    // 模拟组件 props 验证
    var props = { name: "张三", email: "zhangsan@example.com" };
    var initials = props.name.split(" ").map(function(n) { return n[0]; }).join("").toUpperCase();
    return { valid: true, initials: initials, props: props };
  `);

  console.log(`  🔧 CodeAgent 执行验证代码`);
  if (verification.success) {
    console.log(`  ✅ 验证通过, 输出: ${JSON.stringify(verification.output)}`);
  } else {
    console.log(`  ❌ 验证失败: ${verification.error}`);
  }

  // 任务 3：生成使用示例
  console.log('\n━━━ 任务 3：生成使用示例 ━━━\n');

  const STORIES_FILE = join(SRC_DIR, 'UserCard.stories.tsx');

  const { generate: storyGenerate } = createMockModel([
    function () {
      const storiesCode = [
        "import { UserCard } from './UserCard';",
        '',
        'export default { title: "Components/UserCard" };',
        '',
        'export const Default = () => (',
        '  <UserCard name="张三" email="zhangsan@example.com" avatar="https://example.com/avatar.jpg" />',
        ');',
        '',
        'export const NoAvatar = () => (',
        '  <UserCard name="李四" email="lisi@example.com" />',
        ');',
        '',
        'export const LongName = () => (',
        '  <UserCard name="这是一个非常非常长的用户名称用于测试溢出" email="long@test.com" />',
        ');',
      ].join('\n');
      return {
        text: `Thought: 现在生成 Storybook 使用示例
Action: file
Action Input: {"action": "write", "path": ${JSON.stringify(STORIES_FILE)}, "content": ${JSON.stringify(storiesCode)}}`,
        usage: { promptTokens: 250, completionTokens: 120 },
        stopReason: 'stop',
      };
    },
    `Thought: 故事文件已写入
Final Answer: 已生成 UserCard.stories.tsx，包含 3 个 story：默认状态、无头像状态、长文本溢出状态。`,
  ]);

  const agent2 = new ReactAgent({
    tools: [new FileTool(fileSandbox)],
    eventBus,
    maxSteps: 10,
    maxRetries: 2,
    sandbox: fileSandbox,
  });

  const result3 = await agent2.run(storyGenerate, '为 UserCard 组件生成 Storybook 使用示例');
  console.log(`\n📋 结果: ${result3}`);

  // 验证生成的文件
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 生成的文件:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n--- src/components/UserCard.tsx ---');
  console.log(readFileSync(COMPONENT_FILE, 'utf-8'));

  console.log('\n--- src/components/UserCard.stories.tsx ---');
  console.log(readFileSync(STORIES_FILE, 'utf-8'));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 工具调用统计: ${toolCalls.length} 次`);

  // 清理
  rmSync(PROJECT, { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(PROJECT, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
