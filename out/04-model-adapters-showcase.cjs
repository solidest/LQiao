/**
 * 示例四：多模型适配演示 — 五大模型Provider切换 + 流式输出
 *
 * 场景：展示 OpenAI、Anthropic、通义千问(DashScope)、DeepSeek、Ollama
 * 五大模型Provider的创建方式、请求参数和流式输出。
 *
 * 覆盖功能：
 *   - v1.2: DashScopeModel, DeepSeekModel, OllamaModel
 *   - 所有模型: BaseModel, ModelRegistry, stream/generate
 *   - 错误处理: LQiaoError, ERROR_TYPES, NetworkError
 *   - 工具函数: withRetry
 *
 * 运行方式：从项目根目录执行  node out/04-model-adapters-showcase.cjs
 *
 * 注意：本示例使用 mock model 模拟 API 响应。
 *       真实使用时替换为实际的 API Key 和 baseUrl。
 */

const {
  OpenAIModel, AnthropicModel, DashScopeModel, DeepSeekModel, OllamaModel,
  ModelRegistry, modelRegistry,
  withRetry,
  ERROR_TYPES,
  createModelError,
  createNetworkError,
  createRateLimitError,
  createMaxRetriesError,
} = require('../dist/cjs/index.cjs');

// ─── Mock 模型工厂 ──────────────────────────────────────────────────
/**
 * 创建模拟模型实例，替代真实 API 调用。
 * 实际使用时直接 new OpenAIModel({ apiKey, model }) 等即可。
 */
function createMockModel(BaseClass, modelProvider) {
  const instance = new BaseClass({
    apiKey: 'mock-key',
    model: 'mock-model',
    baseUrl: 'http://localhost:0',
  });

  // Override generate
  instance.generate = async (prompt, options) => {
    // 模拟网络延迟
    await new Promise(r => setTimeout(r, 50));

    // 模拟重试场景：前两次失败，第三次成功
    if (!instance._mockRetries) instance._mockRetries = 0;
    instance._mockRetries++;

    if (instance._mockRetries === 1) {
      throw createModelError('NETWORK_ERROR', '模拟网络错误');
    }

    return {
      text: `[${modelProvider}] 回复: ${prompt.slice(0, 30)}...`,
      usage: { promptTokens: prompt.length, completionTokens: 20 },
      stopReason: 'stop',
    };
  };

  // Override stream
  instance.stream = async function* (prompt, options) {
    const chunks = ['你好', '，', '这是', modelProvider, '的', '流式', '回复'];
    for (const chunk of chunks) {
      await new Promise(r => setTimeout(r, 10));
      yield { text: chunk, done: false };
    }
    yield { text: '', done: true };
  };

  return instance;
}

// ─── 模型配置列表 ──────────────────────────────────────────────────
const models = [
  { Class: OpenAIModel,     name: 'OpenAI GPT',     provider: 'gpt-4o' },
  { Class: AnthropicModel,  name: 'Anthropic Claude', provider: 'claude-sonnet-4-6' },
  { Class: DashScopeModel,  name: 'DashScope 通义',  provider: 'qwen-max' },
  { Class: DeepSeekModel,   name: 'DeepSeek V3',     provider: 'deepseek-chat' },
  { Class: OllamaModel,     name: 'Ollama 本地',     provider: 'llama3.1' },
];

// ─── 运行 ──────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例四：多模型适配演示');
  console.log('═══════════════════════════════════════════════════\n');

  // ── 任务 1：五大模型 generate 调用 + withRetry ──────────────────
  console.log('━━━ 任务 1：五大模型 generate（带重试） ━━━\n');

  for (const { Class, name, provider } of models) {
    const model = createMockModel(Class, provider);
    model._mockRetries = 0; // 重置重试计数器

    console.log(`📡 ${name} (${provider})`);

    // 使用 withRetry 包装生成调用
    const result = await withRetry(
      () => model.generate('请介绍一下你自己'),
      { maxRetries: 3, baseDelay: 10 },
    );

    console.log(`   → ${result.text}`);
    console.log(`   → Tokens: ${result.usage.promptTokens} prompt / ${result.usage.completionTokens} completion\n`);
  }

  // ── 任务 2：流式输出 ────────────────────────────────────────────
  console.log('━━━ 任务 2：五大模型 stream（流式输出） ━━━\n');

  for (const { Class, name, provider } of models) {
    const model = createMockModel(Class, provider);

    process.stdout.write(`  📡 ${name}: `);
    for await (const chunk of model.stream('流式测试')) {
      if (chunk.done) {
        process.stdout.write(' ✅\n');
      } else {
        process.stdout.write(chunk.text);
      }
    }
  }
  console.log();

  // ── 任务 3：ModelRegistry 注册与切换 ─────────────────────────────
  console.log('━━━ 任务 3：ModelRegistry 解析与创建 ━━━\n');

  // 预注册的 provider 解析
  const testIds = ['gpt-4o', 'claude-sonnet-4-6', 'qwen-max', 'deepseek-chat', 'ollama/llama3.1'];
  console.log('  📋 预注册 Provider 解析:');
  for (const id of testIds) {
    const config = modelRegistry.resolve(id);
    console.log(`  ${id} → provider: ${config?.provider}, baseUrl: ${config?.baseUrl ?? '(默认)'}`);
  }

  // 注册自定义 provider
  modelRegistry.registerProvider('custom', { provider: 'openai', baseUrl: 'http://localhost:8080' });
  console.log(`\n  ✅ 已注册自定义 provider: custom → openai`);

  const customConfig = modelRegistry.resolve('custom-model');
  console.log(`  🔍 custom-model → provider: ${customConfig?.provider}, baseUrl: ${customConfig?.baseUrl}`);

  // ── 任务 4：错误处理演示 ────────────────────────────────────────
  console.log('\n━━━ 任务 4：错误处理演示 ━━━\n');

  // 模拟各种错误类型（注意：createModelError 的参数是 message, details，不是 type）
  const errors = [
    createModelError('API 返回 500 Internal Server Error'),
    createNetworkError('连接超时'),
    createRateLimitError(30, { endpoint: '/v1/chat' }),
    createMaxRetriesError(new Error('timeout')),
  ];

  for (const err of errors) {
    console.log(`  ❌ ${err.type}: ${err.message}`);
    console.log(`     → is LQiaoError: ${err instanceof Error}`);
    console.log(`     → error.type 可用于 switch 判断\n`);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  示例四执行完成');
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
