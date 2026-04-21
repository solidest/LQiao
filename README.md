# LQiao / 灵桥

## 简介

LQiao/灵桥是一个TypeScript智能体框架库，原生支持ReAct、CodeAgent 代码执行、Git / 文件工具、MCP 工具、 Claude Code Skill、沙箱安全。其核心定位是「轻量可嵌入、多生态兼容、企业级可用」，专为TypeScript/JavaScript项目设计，无需厚重依赖，可快速嵌入前端工程、Node\.js服务、VS Code插件等各类场景，让开发者轻松构建具备自主决策、工具调用、流程闭环能力的AI智能体。

灵桥摒弃了LangChain等框架的冗余抽象，以「TypeScript原生语法」为核心，无缝对接主流大模型（GPT/Claude/通义/DeepSeek/Ollama），同时兼容MCP协议、Claude Code Skill格式，完美适配代码修复、Git运维、自动化办公等高频Agent场景，兼顾开发效率与生产稳定性。

## 核心特性

### 1\. 原生TypeScript支持，无缝嵌入TS/JS项目

全量用TypeScript开发，类型定义完整，支持ESModule/CommonJS双模块规范，可直接嵌入Node\.js后端、前端工程、VS Code插件、Electron应用等，无需额外适配，开发体验与常规TS项目完全一致，避免跨语言调用的繁琐。

### 2\. 内置Agent核心能力，开箱即用

- ReAct推理范式：原生实现「思考\-行动\-观察」循环，支持多步骤决策、异常重试、条件分支，适配复杂长任务（如bug修复\+Git提交全流程）。

- CodeAgent代码执行：内置代码解析、执行引擎，支持TypeScript/JavaScript代码实时运行，结合沙箱隔离，避免恶意代码风险。

- 内置工具集：原生集成Git工具（add/commit/push/日志查询）、文件工具（读写/删除/目录遍历），无需额外封装，直接调用。

### 3\. 多生态兼容，降低迁移成本

- MCP协议原生适配：严格遵循Model Context Protocol标准，支持LLM/Agent/Tool之间的标准化通信，可无缝对接其他MCP兼容框架（如AgentScope、AutoGen）。

- Claude Code Skill兼容：支持直接加载Markdown格式的Claude Code Skill，无需格式转换，一键复用现有技能脚本。

- 大模型多适配：统一封装模型调用接口，一行代码切换GPT/Claude/通义等模型，支持本地Ollama模型部署，兼顾隐私与灵活性。

### 4\. 沙箱安全，生产级可控

内置沙箱隔离机制，代码执行、文件操作、Git命令均在隔离环境中运行，可限制操作权限（如禁止删除系统文件、禁止远程Push），支持高危操作人工审批，避免智能体误操作带来的风险，满足企业级生产需求。

### 5\. 轻量无冗余，启动快速

核心代码仅几千行，无厚重依赖，打包后体积小，冷启动速度快（毫秒级），可长期驻留后台运行，适合边缘设备、轻量服务等资源受限场景。

## 核心架构

灵桥采用「分层解耦\+事件驱动」架构，分为4层，各层独立可扩展，便于自定义开发与维护：

### 1\. 模型层（Model Layer）

统一封装大模型调用接口，支持流式输出、上下文管理、模型切换，内置重试机制，屏蔽不同模型的API差异，开发者无需关注底层调用细节。

### 2\. 智能体层（Agent Layer）

核心层，包含ReAct Agent、CodeAgent两大核心智能体，负责意图解析、步骤规划、工具调度、状态管理，支持多Agent协作（如编码Agent\+运维Agent分工）。

### 3\. 工具层（Tool Layer）

标准化工具接口，内置Git、文件、MCP三类核心工具，同时支持自定义工具注册（通过简单装饰器即可封装自有工具），工具调用统一适配MCP协议格式。

### 4\. 安全层（Security Layer）

包含沙箱隔离、权限控制、操作审计三大模块，记录智能体所有操作日志，支持异常拦截与回滚，保障智能体运行安全。

## 适用场景

- 代码运维智能体：自动定位bug、修复代码、执行Git提交/推送，适配VS Code插件开发场景。

- Node\.js服务自动化：文件批量处理、日志分析、接口调用自动化，嵌入后端服务实现无人值守。

- 前端工程助手：自动生成代码、修复ESLint错误、打包构建辅助，提升前端开发效率。

- 私有化智能体部署：支持本地模型（Ollama）部署，数据不联网，适配企业内部隐私需求。

- MCP协议对接：作为MCP Agent节点，与其他MCP兼容框架互联互通，构建复杂智能体流水线。

## 快速入门（极简示例）

安装依赖：

```bash
npm install lqiao --save
# 或 yarn add lqiao
```

核心代码（bug修复\+Git提交）：

```typescript
import { Agent, GitTool, FileTool } from 'lqiao';

// 1. 初始化智能体（配置模型、工具）
const agent = new Agent({
  model: 'claude-3.7',
  apiKey: 'your-api-key',
  tools: [new FileTool(), new GitTool()], // 加载文件、Git工具
  sandbox: true, // 开启沙箱安全
});

// 2. 执行任务（修复bug并Git提交）
agent.run(`
  1. 读取src/main.ts文件，定位代码bug
  2. 修复bug逻辑
  3. 执行git add src/main.ts
  4. 执行git commit -m "fix: 修复main.ts逻辑错误"
`).then(result => {
  console.log('任务执行完成：', result);
}).catch(error => {
  console.error('任务执行失败：', error);
});
```

## 与主流框架对比（优势）

- 对比LangChain：更轻量，无冗余抽象，TypeScript原生支持，嵌入TS项目更顺畅，无需额外适配。

- 对比AgentScope：专注TS/JS生态，体积更小，启动更快，适合前端/Node\.js场景，而非Java/Python主导的企业级部署。

- 对比smolagents：TypeScript原生，而非Python，更适配前端/Node\.js开发者，工具集更贴合TS项目需求（如前端代码修复）。

## 总结

LQiao/灵桥是TypeScript开发者构建AI智能体的首选轻量框架，以「可嵌入、高兼容、高安全」为核心，原生支持ReAct、CodeAgent、Git/文件工具、MCP协议，无需厚重依赖，可快速落地代码运维、自动化办公等高频场景，兼顾开发效率与生产稳定性，尤其适合前端、Node\.js、VS Code插件等TS/JS生态项目。

> （注：文档部分内容可能由 AI 生成）
