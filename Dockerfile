ARG BUN_VERSION=1.4.2
FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

FROM base AS build
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun run db:generate
COPY src ./src

FROM base AS production-dependencies
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --omit=peer

FROM base AS runtime
ENV NODE_ENV=production \
  PORT=3000
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/src ./src
COPY --chown=bun:bun package.json ./

USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e 'const r = await fetch(`http://127.0.0.1:${process.env.PORT}/health`); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "src/server.ts"]
