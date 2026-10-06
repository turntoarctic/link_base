# Linkbase

面向研发团队的 Notion：以页面为中心的协作知识库。设计文档见 [docs/README.md](docs/README.md)（唯一事实源）。

## 当前状态

Phase 0 / Phase 1 / Phase 2（T2.1–T2.11）功能实现完毕：实时协作（WS + 协作光标/在线头像）、版本历史、评论（页面级 + 行内锚点）、Markdown 导入导出、附件、KaTeX/Mermaid/折叠块/查找替换/表格进阶、Base 数据库块（表格/看板）、通知中心、模板三件、公开分享。生产构建与静态托管冒烟通过；浏览器端视觉验收与 Docker 部署验证进行中。

## 技术基线

Bun workspace monorepo：`apps/web`（React 19 + Vite 8 + Tailwind 4 + Tiptap v3）、`apps/server`（Hono on Bun + Drizzle + PostgreSQL，Bun 原生 WebSocket）、共享包 `packages/{types,contracts,database,editor,ydoc}`。

## 开发

```bash
bun install                      # 安装依赖（锁 bun.lock）

# 起本地 PG + Redis（仅数据库两服务；或使用本机原生服务）
docker compose -f docker/compose.dev.yml up -d

cp .env.example .env             # 按需修改
bun run db:migrate               # 建表 + pg_trgm 扩展（增量迁移按序应用）
bun run db:seed                  # （可选）演示用户 dev@linkbase.local / linkbase123 + 模板三件
bun run db:seed:bench 10000      # （可选）万页搜索基准数据

bun dev                          # web(5173, 代理 /api→3001) + server(3001)
```

## 质量门

```bash
bun run check        # typecheck（全 workspace）+ bun test（DB 用例按 DATABASE_URL 门控）+ check-i18n
bun run test:web     # web Vitest 组件测试
bun run build        # 生产构建（editor chunk gz <1MB 预算内）
bun run e2e          # Playwright（需 E2E_API 或本地全栈）
```

## 部署

```bash
docker compose up -d --build     # app(Bun 同进程: 静态 + API + WS) + postgres + redis
```

迁移随 app 启动自动执行；健康检查 `/api/health`。

## 红线（违反即 CRDT 分裂 / 编辑器不可用）

1. **yjs 单实例**：合并前 `bun pm ls yjs react react-dom` 确认无重复（根 `overrides` 已钉死）。
2. 服务端只能 `import '@linkbase/editor/server'`（纯常量），禁止引入编辑器 React/ProseMirror 运行时。
3. 文档内容/光标/选区永不进 React state（06 §3）；`pages.title` 列为标题唯一真相（客户端 PATCH 直写）。
4. UI 文案一律走 i18next（13），禁止硬编码；API 错误按 `LB_*` code 本地化。
