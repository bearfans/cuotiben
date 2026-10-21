FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
# Prisma 通过 openssl CLI 探测运行时版本；slim 镜像默认未安装，会导致生成错误的引擎目标
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm --filter @myos/shared build \
  && pnpm --filter @myos/api prisma:generate \
  && pnpm --filter @myos/api build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl tzdata fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY apps/api/docker-entrypoint.sh /usr/local/bin/api-entrypoint
RUN chmod +x /usr/local/bin/api-entrypoint \
  && mkdir -p /app/storage /ms-playwright \
  && cd /app/apps/api \
  && ./node_modules/.bin/playwright install --with-deps --only-shell chromium \
  && rm -rf /var/lib/apt/lists/* \
  && chown -R node:node /ms-playwright /app/storage
USER node
EXPOSE 3000
ENTRYPOINT ["api-entrypoint"]
