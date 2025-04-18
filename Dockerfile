FROM oven/bun:latest

WORKDIR /app

COPY ./server /app

RUN bun install

CMD [ "bun", "./src/index.ts" ]
