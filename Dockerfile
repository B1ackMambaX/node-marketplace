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
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/src ./src
COPY --chown=bun:bun prisma ./prisma
COPY --chown=bun:bun prisma.config.ts ./
COPY --chown=bun:bun package.json ./

USER bun
CMD ["sh", "-c", "bun run db:deploy && exec bun run start"]
