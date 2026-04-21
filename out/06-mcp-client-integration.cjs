/**
 * 示例六：MCP 协议客户端集成 — Stdio/SSE 传输 + 工具发现 + Agent 融合
 *
 * 场景：创建一个最小 MCP Server（echo 服务），通过 stdio 传输连接，
 * 发现远程工具，将其转换为内部 Tool 接口，再集成到 Agent 中调用。
 *
 * 覆盖功能：
 *   - v1.1: MCPClient, StdioTransport, SSETransport
 *   - v1.1: MCPToolAdapter, wrapMCPTools
 *   - MCP: MCPServerConfig, MCPTool, MCP_EVENTS
 *   - Agent: Agent.initializeMCP (自动初始化 MCP)
 *
 * 运行方式：从项目根目录执行  node out/06-mcp-client-integration.cjs
 */

const {
  MCPClient, MCPClient: { MCP_EVENTS },
  StdioTransport, SSETransport,
  MCPToolAdapter, wrapMCPTools,
  ReactAgent, DefaultEventBus, Sandbox,
  Profiler,
} = require('../dist/cjs/index.cjs');
const { writeFileSync, rmSync, mkdirSync, readFileSync } = require('fs');
const { join } = require('path');

const FIXTURES = join(__dirname, 'fixtures-mcp');
mkdirSync(FIXTURES, { recursive: true });

// ─── 最小 MCP Server（子进程方式） ──────────────────────────────
/**
 * 创建一个最简单的 MCP Server 脚本，支持:
 * - initialize 握手
 * - tools/list 返回一个 echo 工具
 * - tools/call 执行 echo 工具
 */
const mcpServerCode = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

let nextId = 1;

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\\n');
}

rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }

  if (req.method === 'initialize') {
    send({ jsonrpc: '2.0', id: req.id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'echo-mcp', version: '1.0.0' }
    }});
  } else if (req.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: req.id, result: {
      tools: [{
        name: 'echo',
        description: 'Echo back the input message',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string', description: 'Message to echo' } },
          required: ['message']
        }
      }]
    }});
  } else if (req.method === 'tools/call') {
    const msg = req.params?.arguments?.message ?? '';
    send({ jsonrpc: '2.0', id: req.id, result: {
      content: [{ type: 'text', text: 'ECHO: ' + msg }]
    }});
  }
});
`;

const SERVER_PATH = join(FIXTURES, 'echo-server.cjs');
writeFileSync(SERVER_PATH, mcpServerCode, 'utf-8');
console.log('📄 已创建 MCP Server 脚本: echo-server.cjs');

// ─── 运行 ───────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  示例六：MCP 协议客户端集成');
  console.log('═══════════════════════════════════════════════════\n');

  const profiler = new Profiler();

  // ── 任务 1：Stdio 传输连接 + 工具发现 ─────────────────────────
  console.log('━━━ 任务 1：Stdio 连接 + 工具发现 ━━━\n');

  profiler.start('mcp-connect');

  const client = new MCPClient({
    name: 'echo-mcp',
    transport: 'stdio',
    command: 'node',
    args: [SERVER_PATH],
    timeout: 10000,
  });

  // 监听 MCP 事件
  client.on('stateChange', (data) => {
    console.log(`  📡 状态变更: ${data.state}`);
  });

  client.on('toolsDiscovered', (data) => {
    console.log(`  🔧 发现工具: ${data.tools} 个`);
  });

  await client.connect();
  profiler.stop('mcp-connect');

  console.log(`  ✅ MCP 连接成功`);
  console.log(`  📊 连接耗时: ${profiler.getRecords().find(r => r.name === 'mcp-connect')?.duration.toFixed(1)}ms`);

  // ── 任务 2：调用远程工具 ──────────────────────────────────────
  console.log('\n━━━ 任务 2：调用 MCP 远程工具 ━━━\n');

  profiler.start('mcp-call');

  const callResult = await client.callTool('echo', { message: 'Hello from LQiao!' });
  profiler.stop('mcp-call');

  console.log(`  📤 调用: echo({ message: "Hello from LQiao!" })`);
  console.log(`  📥 响应:`, JSON.stringify(callResult));
  console.log(`  📊 调用耗时: ${profiler.getRecords().find(r => r.name === 'mcp-call')?.duration.toFixed(1)}ms`);

  // ── 任务 3：MCP 工具转内部 Tool 接口 ──────────────────────────
  console.log('\n━━━ 任务 3：MCP 工具适配 ━━━\n');

  const mcpTools = client.tools;
  const adaptedTools = wrapMCPTools(client, mcpTools);

  console.log(`  🔄 已适配 ${adaptedTools.length} 个 MCP 工具:`);
  for (const tool of adaptedTools) {
    console.log(`    - ${tool.name}: ${tool.description}`);
  }

  // 直接调用适配后的工具
  const echoTool = adaptedTools[0];
  const toolResult = await echoTool.execute({ message: '测试适配工具' });
  console.log(`  📤 执行 ${echoTool.name}: ${JSON.stringify(toolResult)}`);

  // ── 任务 4：将 MCP 工具集成到 ReactAgent ──────────────────────
  console.log('\n━━━ 任务 4：MCP 工具集成到 Agent ━━━\n');

  const eventBus = new DefaultEventBus();
  eventBus.on('onToolCall', (data) => {
    console.log(`  🔧 Agent 调用: ${data.tool}`);
  });
  eventBus.on('onToolResult', (data) => {
    if (data.result?.success) {
      console.log(`  ✅ 结果: ${JSON.stringify(data.result.data).slice(0, 80)}`);
    }
  });

  // Mock model 触发工具调用
  function createMockModel(steps) {
    let idx = 0;
    return {
      async generate() {
        const step = steps[idx] ?? steps[steps.length - 1];
        idx++;
        if (typeof step === 'function') return step();
        return { text: step, usage: { promptTokens: 100, completionTokens: 50 }, stopReason: 'stop' };
      },
      async *stream() { yield { text: 'ok', done: true }; },
    };
  }

  const { generate } = createMockModel([
    `Thought: 使用 echo 工具测试
Action: echo
Action Input: {"message": "Agent 调用 MCP 工具"}`,
    `Thought: 工具已执行
Final Answer: MCP 工具调用成功，返回: ECHO: Agent 调用 MCP 工具`,
  ]);

  const agent = new ReactAgent({
    tools: adaptedTools,
    eventBus,
    maxSteps: 10,
    maxRetries: 1,
  });

  const result = await agent.run(generate, '调用 echo 工具发送消息');
  console.log(`  📋 Agent 结果: ${result}`);

  // ── 任务 5：断开连接 ──────────────────────────────────────────
  console.log('\n━━━ 任务 5：断开 MCP 连接 ━━━\n');

  await client.disconnect();
  console.log(`  🔌 MCP 连接已断开`);

  // ── 汇总 ──────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 性能记录:');
  for (const r of profiler.getRecords()) {
    console.log(`   ${r.name}: ${r.duration.toFixed(2)}ms`);
  }

  // 清理
  rmSync(FIXTURES, { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  示例六执行完成');
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(FIXTURES, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
