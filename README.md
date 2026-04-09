# Darts Scorer 🎯

Веб-приложение для подсчёта очков в дартс с интерактивной SVG-доской. Поддерживает режимы X01 (301, 501, 701) с полной реализацией правил.

## Возможности

- **Интерактивная доска дартса** — кликабельная SVG-мишень с определением single/double/triple/bull зон
- **Правила X01** — double out, bust (перебор), автоматическая смена ходов
- **Мультиплеер** — от 2 до 8 игроков, совместная игра по ссылке
- **Подсказки финиша** — рекомендации как закрыть оставшиеся очки (2–170)
- **Откат ходов** — отмена последнего хода с восстановлением счёта
- **Real-time синхронизация** — long polling для обновлений между игроками
- **Тёмная/светлая тема** — переключение в один клик
- **Адаптивный дизайн** — удобен на ПК и телефоне
- **Звуковые эффекты** — синтетические тоны через Web Audio API
- **Страница правил** — подробное описание правил на русском языке

## Стек технологий

- **Frontend:** React, Tailwind CSS, shadcn/ui, Framer Motion, wouter
- **Backend:** Express.js, Drizzle ORM, better-sqlite3
- **Сборка:** Vite, TypeScript, esbuild

## Запуск

### Локально

```bash
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:5000`

### Docker

```bash
docker build -t darts-scorer .
docker run -p 3000:3000 -v darts-data:/app/data darts-scorer
```

Приложение будет доступно на `http://localhost:3000`

### Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `3000` (Docker) / `5000` (local) | Порт сервера |
| `DATABASE_PATH` | `data.db` | Путь к файлу SQLite БД |

## Структура проекта

```
├── client/src/           # React frontend
│   ├── components/game/  # Dartboard, scoreboard, history
│   ├── pages/            # Home, Game, Rules
│   ├── hooks/            # Polling, visitor ID
│   └── lib/              # Utils, sounds, types
├── server/               # Express backend
│   ├── routes.ts         # API endpoints
│   ├── storage.ts        # Database layer
│   └── gameLogic.ts      # Game rules engine
├── shared/schema.ts      # DB schema + types
├── Dockerfile
└── docker-compose.yml
```

## API

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/games` | Создание новой игры |
| GET | `/api/games/:code` | Состояние игры |
| POST | `/api/games/:code/turns` | Запись хода |
| POST | `/api/games/:code/undo` | Откат последнего хода |
| GET | `/api/games/:code/poll?since=N` | Long polling |

## Лицензия

MIT
