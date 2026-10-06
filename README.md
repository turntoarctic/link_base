# Linkbase

面向研发团队的 Notion：以页面为中心的协作知识库。设计文档见 [docs/README.md](docs/README.md)（唯一事实源）。

## 技术基线

Bun workspace monorepo：`apps/web`（React 19 + Vite 8 + Tailwind 4 + Tiptap v3）、`apps/server`（Hono on Bun + Drizzle + PostgreSQL）、共享包 `packages/{types,contracts,database,editor,ydoc}`。

## 开发

```bash
bun install                      # 安装依赖（锁 bun.lock）

# 起本地 PG + Redis（仅数据库两服务）
docker compose -f docker/compose.dev.yml up -d

cp .env.example .env             # 按需修改
bun run db:migrate               # 建表 + pg_trgm 扩展
bun run db:seed                  # （可选）创建演示用户 dev@linkbase.local / linkbase123

bun dev                          # web(5173, 代理 /api→3001) + server(3001)
```

质量门：

```bash
bun run typecheck    # 全 workspace tsc --noEmit
bun run test         # server/共享包 bun test（DB 用例按 DATABASE_URL 门控）
bun run test:web     # web Vitest 组件测试
bun run check-i18n   # i18n key 对齐 / 错误码覆盖 / 无硬编码文案
bun run e2e          # Playwright（需 E2E_API 或本地全栈）
```

## 部署

```bash
docker compose up -d --build     # app(Bun 同进程: 静态 + API + WS) + postgres + redis
```

迁移在 app 启动时自动执行；健康检查 `/api/health`。

## 红线（违反即 CRDT 分裂 / 编辑器不可用）

1. **yjs 单实例**：合并前 `bun pm ls yjs react react-dom` 确认无重复（根 `overrides` 已钉死）。
2. 服务端只能 `import '@linkbase/editor/server'`（纯常量），禁止引入编辑器 React/ProseMirror 运行时。
3. 文档内容/光标/选区永不进 React state（06 §3）；`pages.title` 列为标题唯一真相（客户端 PATCH 直写）。
4. UI 文案一律走 i18next（13），禁止硬编码；API 错误按 `LB_*` code 本地化。
