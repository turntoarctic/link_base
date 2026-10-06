# docker/app.Dockerfile（11 §3）：oven/bun:1-alpine 多阶段；服务端无编译产物，仅前端走 Vite 构建
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY apps/e2e/package.json apps/e2e/
COPY packages/types/package.json packages/types/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY packages/editor/package.json packages/editor/
COPY packages/ydoc/package.json packages/ydoc/
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN cd apps/web && bun run build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bunfig.toml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 3001
CMD ["bun", "run", "apps/server/src/index.ts"]
