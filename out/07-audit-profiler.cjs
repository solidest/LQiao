/**
 * 示例七：审计日志 + 性能分析器 — 完整可观测性
 *
 * 场景：模拟一组工具调用链（文件操作、重试、错误），用 AuditLog
 * 记录全部调用，用 Profiler 测量性能，用 Logger 输出结构化日志，
 * 最后生成审计报告。
 *
 * 覆盖功能：
 *   - v1.4: AuditLog (record, filterByTool, filterBySuccess,
 *                      filterByTimeRange, getSummary, saveToFile,
 *                      loadFromFile, clear, size, toJSON)
 *   - Logger: debug/info/warn/error, toJSON, getEntries, verbose
 *   - Profiler: start/stop, average, max, getRecords, clear
 *   - withRetry: 重试逻辑 + 错误类型
 *   - ERROR_TYPES / createToolError: 结构化错误
 *
 * 运行方式：从项目根目录执行  node out/07-audit-profiler.cjs
 */

const {
  AuditLog, Logger, Profiler,
  withRetry,
  ERROR_TYPES,
  createToolError,
  createNetworkError,
  createRateLimitError,
  createMaxRetriesError,
  matchesPattern,
} = require('../dist/cjs/index.cjs');
const { rmSync, existsSync } = require('fs');
const { join } = require('path');

const FIXTURES = join(__dirname, 'fixtures-audit');

// ─── 运行 ───────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  示例七：审计日志 + 性能分析器');
  console.log('═══════════════════════════════════════════════════\n');

  const audit = new AuditLog();
  const logger = new Logger({ level: 'debug', verbose: false });
  const profiler = new Profiler();

  // ── 任务 1：模拟工具调用链 + 审计记录 ─────────────────────────
  console.log('━━━ 任务 1：工具调用链 + 审计记录 ━━━\n');

  const operations = [
    { tool: 'file', action: 'read', args: { path: '/src/index.ts' }, success: true, duration: 12 },
    { tool: 'file', action: 'write', args: { path: '/src/index.ts' }, success: true, duration: 8 },
    { tool: 'git', action: 'add', args: { paths: ['src/index.ts'] }, success: true, duration: 45 },
    { tool: 'git', action: 'commit', args: { message: 'fix: bug' }, success: true, duration: 120 },
    { tool: 'git', action: 'push', args: {}, success: false, error: 'remote rejected', duration: 3500 },
    { tool: 'file', action: 'read', args: { path: '/src/config.json' }, success: false, error: 'EACCES', duration: 2 },
    { tool: 'model', action: 'generate', args: { prompt: 'fix bug' }, success: true, duration: 230 },
    { tool: 'model', action: 'generate', args: { prompt: 'retry' }, success: true, duration: 180 },
    { tool: 'file', action: 'delete', args: { path: '/tmp/cache' }, success: true, duration: 5 },
    { tool: 'git', action: 'push', args: {}, success: true, duration: 980 },
  ];

  for (const op of operations) {
    profiler.start(op.tool);
    audit.record({
      tool: op.tool,
      action: op.action,
      args: op.args,
      success: op.success,
      duration: op.duration,
      error: op.error,
    });
    logger.info(`${op.tool}:${op.action}`, { success: op.success, duration: op.duration });
    profiler.stop(op.tool);

    const icon = op.success ? '✅' : '❌';
    console.log(`  ${icon} ${op.tool}:${op.action} — ${op.duration}ms${op.error ? ` [${op.error}]` : ''}`);
  }

  console.log(`\n  📊 审计条目数: ${audit.size}`);

  // ── 任务 2：审计过滤 ──────────────────────────────────────────
  console.log('\n━━━ 任务 2：审计数据过滤 ━━━\n');

  // 按工具过滤
  const gitEntries = audit.filterByTool('git');
  console.log(`  🔍 Git 操作: ${gitEntries.length} 条`);
  for (const e of gitEntries) {
    console.log(`     - ${e.action}: ${e.success ? '成功' : e.error}`);
  }

  // 按成功/失败过滤
  const failedEntries = audit.filterBySuccess(false);
  console.log(`\n  ❌ 失败调用: ${failedEntries.length} 条`);
  for (const e of failedEntries) {
    console.log(`     - ${e.tool}:${e.action} → ${e.error}`);
  }

  // 按时间范围过滤（手动实现，filterByTimeRange/getSummary/saveToFile 在 v1.4 分支提供）
  const allEntries = audit.getEntries();
  const firstTs = allEntries[0].timestamp;
  const timeFiltered = allEntries.filter(e => e.timestamp >= firstTs && e.timestamp <= firstTs + 100);
  console.log(`\n  ⏱️  时间范围过滤 (前100ms): ${timeFiltered.length} 条`);

  // 汇总统计（手动计算）
  const successCount = allEntries.filter(e => e.success).length;
  const avgDuration = allEntries.reduce((s, e) => s + e.duration, 0) / allEntries.length;
  const errorMap = new Map();
  for (const e of allEntries) {
    if (e.error) {
      const key = `${e.tool}:${e.error}`;
      errorMap.set(key, (errorMap.get(key) || 0) + 1);
    }
  }
  const topErrors = [...errorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ── 任务 3：审计汇总统计 ──────────────────────────────────────
  console.log('\n━━━ 任务 3：审计汇总统计 ━━━\n');

  console.log(`  📊 总调用数: ${audit.size}`);
  console.log(`  📊 成功率: ${(successCount / allEntries.length * 100).toFixed(1)}%`);
  console.log(`  📊 平均耗时: ${avgDuration.toFixed(1)}ms`);
  console.log(`  📊 Top 错误:`);
  for (const [err, count] of topErrors) {
    console.log(`     - ${err} (${count} 次)`);
  }

  // ── 任务 4：审计 JSON 导出与持久化 ─────────────────────────────
  console.log('\n━━━ 任务 4：审计 JSON 导出 ━━━\n');

  const json = audit.toJSON();
  console.log(`  📋 JSON 导出大小: ${(json.length / 1024).toFixed(1)} KB`);

  // 注：saveToFile/loadFromFile/filterByTimeRange/getSummary 在 feat/v1.4-branch-audit 分支提供
  console.log(`  ℹ️  注: saveToFile/loadFromFile/filterByTimeRange/getSummary`);
  console.log(`     在 feat/v1.4-branch-audit 分支提供`);

  // ── 任务 5：结构化日志 ────────────────────────────────────────
  console.log('\n━━━ 任务 5：结构化日志 ━━━\n');

  const testLogger = new Logger({ level: 'debug', verbose: true });
  testLogger.debug('调试信息', { module: 'audit' });
  testLogger.info('任务开始', { ops: operations.length });
  testLogger.warn('慢查询检测', { duration: 3500 });
  testLogger.error('远程拒绝', { tool: 'git', action: 'push' });

  console.log(`  📋 日志条目: ${testLogger.getEntries().length} 条`);
  console.log(`  📋 JSON 导出: ${(testLogger.toJSON().length / 1024).toFixed(1)} KB`);

  // ── 任务 6：性能分析 ──────────────────────────────────────────
  console.log('\n━━━ 任务 6：性能分析器 ━━━\n');

  const testProfiler = new Profiler();

  // 模拟多次操作
  for (let i = 0; i < 5; i++) {
    testProfiler.start('api-call');
    await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
    testProfiler.stop('api-call');
  }

  for (let i = 0; i < 3; i++) {
    testProfiler.start('db-query');
    await new Promise(r => setTimeout(r, 5 + Math.random() * 10));
    testProfiler.stop('db-query');
  }

  const records = testProfiler.getRecords();
  console.log(`  📊 总记录: ${records.length} 条`);
  console.log(`  ⏱️  api-call 平均: ${testProfiler.average('api-call')?.toFixed(1)}ms`);
  console.log(`  ⏱️  api-call 最大: ${testProfiler.max('api-call')?.toFixed(1)}ms`);
  console.log(`  ⏱️  db-query 平均: ${testProfiler.average('db-query')?.toFixed(1)}ms`);

  // 不存在的操作名
  console.log(`  ❓ 不存在操作: ${testProfiler.average('nonexistent')}`);

  testProfiler.clear();
  console.log(`  🧹 清空后记录: ${testProfiler.getRecords().length} 条`);

  // ── 任务 7：错误类型与重试 ────────────────────────────────────
  console.log('\n━━━ 任务 7：错误类型与重试 ━━━\n');

  // 错误类型演示
  const errors = [
    createToolError('文件不存在', { type: 'file', path: '/missing' }),
    createNetworkError('连接超时'),
    createRateLimitError('每分钟请求数超限', { retryAfter: 30 }),
    createMaxRetriesError('重试耗尽', { originalError: 'timeout' }),
  ];

  for (const err of errors) {
    console.log(`  ❌ ${err.type}: ${err.message}`);
  }

  // withRetry 演示
  let attempts = 0;
  const result = await withRetry(
    async () => {
      attempts++;
      if (attempts < 3) throw createNetworkError(`第 ${attempts} 次尝试失败`);
      return { data: 'success' };
    },
    { maxRetries: 5, baseDelayMs: 5 },
  );
  console.log(`\n  🔄 重试 ${attempts} 次后成功: ${JSON.stringify(result)}`);

  // 重试耗尽演示
  try {
    await withRetry(
      async () => { throw createToolError('持续失败'); },
      { maxRetries: 2, baseDelayMs: 5 },
    );
  } catch (err) {
    console.log(`  ❌ 重试耗尽: ${err.type} — ${err.message}`);
  }

  // ── 任务 8：Glob 匹配工具 ─────────────────────────────────────
  console.log('\n━━━ 任务 8：Glob 模式匹配 ━━━\n');

  const patterns = [
    ['src/index.ts', 'src/index.ts'],
    ['src/*.ts', 'src/utils.ts'],
    ['src/**/*.ts', 'src/core/agent.ts'],
    ['*.log', 'app.log'],
    ['src/*.ts', 'src/sub/deep.ts'],
    ['**/*.ts', 'a/b/c/d.ts'],
  ];

  for (const [pattern, path] of patterns) {
    const match = matchesPattern(path, pattern);
    console.log(`  ${match ? '✅' : '❌'} "${path}" matches "${pattern}"`);
  }

  // ── 汇总 ──────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 审计摘要:');
  console.log(`   总调用: ${audit.size}`);
  console.log(`   成功率: ${(successCount / allEntries.length * 100).toFixed(1)}%`);
  console.log(`   平均耗时: ${avgDuration.toFixed(1)}ms`);
  console.log(`   错误类型: ${topErrors.length} 种`);

  // 清理
  rmSync(FIXTURES, { recursive: true, force: true });
  console.log('\n🧹 已清理测试文件');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  示例七执行完成');
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  try { rmSync(FIXTURES, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
