FROM oven/bun:1.4.2

WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:dev
CMD ["bun", "run", "start"]