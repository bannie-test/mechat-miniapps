# syntax=docker/dockerfile:1
# All mini apps in one nginx image: /garden/, /lunar/, …
#   docker build -t iemanchat-miniapps . && docker run -p 8081:80 -e HOST_ORIGINS=https://chat.example.com iemanchat-miniapps
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/miniapp-sdk/package.json packages/miniapp-sdk/
COPY apps/garden/package.json apps/garden/
COPY apps/lunar/package.json apps/lunar/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-env-js.sh /docker-entrypoint.d/40-env-js.sh
COPY --from=build /repo/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
