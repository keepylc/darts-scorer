FROM node:20-alpine AS builder

WORKDIR /app

# Установка зависимостей для сборки native-модулей (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# -----------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=builder /app/dist ./dist

# Директория для SQLite БД (можно монтировать volume)
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/darts.db

# По умолчанию слушаем порт 3000, можно переопределить через -e PORT=XXXX
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.cjs"]
