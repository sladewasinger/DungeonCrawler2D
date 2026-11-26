FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/content/package.json packages/content/package.json
COPY packages/engine/package.json packages/engine/package.json
COPY packages/game-server/package.json packages/game-server/package.json
COPY packages/client/package.json packages/client/package.json

RUN npm ci --workspace=@dc2d/game-server --workspace=@dc2d/engine --workspace=@dc2d/content --include-workspace-root

COPY packages/content packages/content
COPY packages/engine packages/engine
COPY packages/game-server packages/game-server

RUN npm run build -w @dc2d/game-server

FROM node:24-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache su-exec

COPY --from=builder --chown=node:node /app/packages/game-server/dist/main.cjs /app/main.cjs
COPY --from=builder --chown=node:node /app/packages/game-server/dist/main.cjs.map /app/main.cjs.map

ENV NODE_ENV=production
ENV PORT=8080
ENV GAME_HOST=0.0.0.0
ENV WORLD_SAVE_PATH=/data/world-save.json

EXPOSE 8080

CMD ["sh", "-c", "mkdir -p /data && chown -R node:node /data && exec su-exec node node /app/main.cjs"]
