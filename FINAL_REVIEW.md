# FINAL CODE REVIEW — Darts Scorer

Ревью проведено по всем 23 ключевым файлам проекта.

---

## CRITICAL (блокирующие баги)

### C1. `buildGameState()` использует `db` внутри `db.transaction()`
**Файл:** `server/storage.ts`, строки 206–212, 276–281  
**Описание:** Методы `submitTurn()` и `undoLastTurn()` вызывают `this.buildGameState(updatedGame)` внутри `db.transaction((tx) => {...})`. Но `buildGameState()` (строки 298–397) делает все запросы через глобальный `db`, а не через `tx`.

**Проблема:** С SQLite + WAL это работает на чтение (WAL разрешает чтение вне транзакции), но данные, записанные через `tx`, ещё не закоммичены в момент вызова `buildGameState`. Это означает:
- `buildGameState` может вернуть **устаревшие данные** (до коммита транзакции), потому что он читает через отдельное соединение/snapshot.
- В реальности better-sqlite3 использует одно соединение синхронно, поэтому `db.transaction()` коммитит только после возврата callback. Внутри callback `db` и `tx` видят одни и те же данные, т.к. это одно соединение.

**Вердикт:** В текущей реализации (better-sqlite3, одно соединение, синхронный код) баг **не проявляется** — `db` и `tx` это один и тот же underlying connection. Однако код архитектурно неправильный и сломается при переходе на async драйвер или пул. Рекомендуется передать `tx` в `buildGameState` или вынести вызов за пределы транзакции.

**Уровень:** CRITICAL (архитектурный — не ломает сейчас, но создаёт хрупкость)

### C2. Нет автоматической миграции/создания таблиц при старте
**Файл:** `server/storage.ts`, строки 25–29; `Dockerfile`, строка 34  
**Описание:** При первом запуске в Docker (`CMD ["node", "dist/index.cjs"]`) база данных создаётся пустой. Таблицы не существуют — нет ни автоматического `db:push`, ни `drizzle-kit migrate`, ни ручного `CREATE TABLE`. Первый запрос к `/api/games` упадёт с `SqliteError: no such table: games`.

**Исправление:** Добавить программную миграцию при старте сервера или добавить `RUN npm run db:push` в Dockerfile (но для этого нужна БД на этапе сборки). Лучшее решение — программно вызвать `drizzle-kit push` или написать SQL-миграцию и применять её при старте.

---

## IMPORTANT (стоит исправить)

### I1. Несоответствие типов frontend/backend: `dartsInTurn` в recentHistory
**Файл:** `client/src/lib/types.ts`, строка 31  
**Описание:** Фронтенд-тип `GameState.recentHistory[].dartsInTurn: number` объявлен, но бэкенд (`shared/schema.ts`, строки 140–150) **не возвращает** это поле. Серверный `buildGameState()` (строки 365–388) не включает `dartsInTurn` в объект recentHistory.

**Последствие:** Если фронтенд попробует использовать `dartsInTurn`, значение будет `undefined`. Пока что оно нигде на фронтенде не используется, так что runtime-ошибок нет, но тип вводит в заблуждение.

**Исправление:** Удалить `dartsInTurn` из `client/src/lib/types.ts` или добавить поле в серверный ответ.

### I2. Несоответствие типов: frontend `GameState` не имеет `currentTurn`
**Файл:** `client/src/lib/types.ts` (весь файл), `shared/schema.ts`, строки 134–139  
**Описание:** Бэкенд возвращает `currentTurn: { playerId, turnNumber, throws, runningScore } | null`, но фронтенд-тип `GameState` вообще не содержит этого поля. Фронтенд не использует его (хранит throws в локальном state), но серверные данные приходят и тихо игнорируются.

**Последствие:** Не баг, но лишние данные передаются по сети (пустой объект `{ throws: [], runningScore: N }` на каждый poll). При будущей работе над real-time синхронизацией это может вызвать путаницу.

### I3. Stale closure в `onThrow` → `confirmTurn` 
**Файл:** `client/src/pages/GamePage.tsx`, строки 50–103, 106–144  
**Описание:** `onThrow` создаётся через `useCallback` с dependencies `[currentThrows, gameState, scoreBefore, isSending]`. Внутри `onThrow` через `setTimeout` вызывается `confirmTurn`. Но `confirmTurn` **не включён** в dependency array `onThrow`.

Когда `confirmTurn` пересоздаётся (например, из-за изменения `currentPlayer` или `shareCode`), `onThrow` продолжает ссылаться на старую версию `confirmTurn`.

**Последствие:** На практике это не вызывает проблем, потому что:
1. `confirmTurn` принимает `throws` как аргумент (не берёт из closure)
2. `currentPlayer` и `shareCode` не меняются в рамках одной игры
3. `isSending` проверяется внутри `confirmTurn`

Но это хрупкий код — при рефакторинге легко сломается. Рекомендуется добавить `confirmTurn` в dependencies `onThrow` или использовать `useRef` для `confirmTurn`.

### I4. `queryKey` в `useGamePolling` содержит только `["/api/games", shareCode]`, но fetch URL меняется
**Файл:** `client/src/hooks/useGamePolling.ts`, строки 12–13, 15–17  
**Описание:** `queryKey` всегда `["/api/games", shareCode]`, но `queryFn` меняет URL в зависимости от `lastUpdatedAt.current`: первый запрос идёт на `/api/games/${shareCode}`, последующие — на `/api/games/${shareCode}/poll?since=...`. Это нарушает конвенцию React Query, где `queryKey` должен идентифицировать данные.

**Последствие:** Работает корректно благодаря ручному управлению `staleTime: Infinity` и `refetchInterval`. Но если использовать стандартные механизмы React Query (invalidation, refetch), они могут вызвать unexpected poll вместо full fetch.

### I5. Long-polling: no timeout для waiter при server shutdown
**Файл:** `server/routes.ts`, строки 116–163  
**Описание:** При завершении работы сервера (graceful shutdown) все pending long-poll waiters остаются висеть. Express закроет соединения, но нет cleanup-механизма для map `waiters`. Это не утечка памяти (соединения закроются по `req.on("close")`), но клиенты получат connection reset вместо корректного ответа.

### I6. Отсутствует `gameId` в фронтенд-типе `players`
**Файл:** `client/src/lib/types.ts`, строки 11–22  
**Описание:** Бэкенд (`shared/schema.ts`) возвращает `Player` с полем `gameId`, но фронтенд-тип не включает его. Серверный JSON содержит `gameId`, он приходит клиенту, но не типизирован.

**Последствие:** Нет runtime-ошибки (поле есть в данных), но TypeScript не знает о нём.

### I7. `DartboardSVG`: single vs outer single highlight неточный
**Файл:** `client/src/components/game/DartboardSVG.tsx`, строки 71–73  
**Описание:** При `multiplier === 1` подсвечивается только inner single (от `R_BULL` до `R_INNER_SINGLE`), хотя outer single (от `R_TRIPLE_OUTER` до `R_OUTER_SINGLE`) тоже даёт `multiplier === 1`. Комментарий "highlight both" в строке 72 не соответствует коду — подсвечивается только одна зона.

---

## MINOR (мелочи)

### M1. AnimatePresence key={i} в HomePage для playerNames
**Файл:** `client/src/pages/HomePage.tsx`, строка 157  
**Описание:** `key={i}` (индекс) используется в `AnimatePresence`. При удалении игрока из середины списка (невозможно в текущем UI, но архитектурно) анимация будет некорректной. В текущей реализации (только добавление/удаление с конца) это ОК.

### M2. not-found.tsx использует hardcoded цвета вместо CSS variables
**Файл:** `client/src/pages/not-found.tsx`, строки 6, 10, 11, 14  
**Описание:** `bg-gray-50`, `text-red-500`, `text-gray-900`, `text-gray-600` — хардкодные цвета вместо семантических (`bg-background`, `text-destructive`, `text-foreground`, `text-muted-foreground`). Не будут корректно работать в тёмной теме.

### M3. ThemeToggle не сохраняет состояние между перезагрузками
**Файл:** `client/src/components/layout/AppHeader.tsx`, строки 6–17  
**Описание:** Тема хранится только в React state и DOM class. При перезагрузке страницы сбрасывается. Не используется ни `localStorage`, ни `prefers-color-scheme`. Это корректно по ТЗ (нет localStorage), но пользователь потеряет выбранную тему.

### M4. `registerRoutes` объявлена как `async` без необходимости
**Файл:** `server/routes.ts`, строка 35  
**Описание:** `async function registerRoutes(...)` — функция не использует `await` внутри. Можно убрать `async`, но это не влияет на работу (возвращается `Promise<Server>` в обоих случаях).

### M5. Дублирование formatThrow / throwPoints / isDouble / getSuggestedFinish
**Файл:** `server/gameLogic.ts` и `client/src/lib/dartUtils.ts`  
**Описание:** Одинаковая логика продублирована на сервере и клиенте. Отличия:
- Клиентский `formatThrow` использует русский "Мимо" и "D-Bull", серверный — "MISS" и "DBull"
- Finish table на клиенте имеет overrides для popular finishes, серверная — нет

Это не баг (сервер и клиент используют свои копии), но при расхождении логики bust-check может быть несовпадение preview и серверного результата.

### M6. Confetti canvas не адаптируется при resize
**Файл:** `client/src/components/game/WinOverlay.tsx`, строки 24–25  
**Описание:** Canvas size устанавливается один раз (`window.innerWidth/innerHeight`). При повороте мобильного устройства confetti обрезается.

### M7. Logging middleware логирует полный JSON ответа
**Файл:** `server/index.ts`, строки 36–60  
**Описание:** `capturedJsonResponse` логирует весь JSON-body, включая полный GameState с историей. Для production это избыточно и может замедлить логирование.

### M8. docker-compose version deprecated
**Файл:** `docker-compose.yml`, строка 1  
**Описание:** `version: "3.8"` deprecated в modern Docker Compose v2. Не вызывает ошибку, но генерирует warning.

---

## VERDICT: Конкретные файлы и строки для исправления

| # | Приоритет | Файл | Строки | Что исправить |
|---|-----------|------|--------|---------------|
| C2 | **CRITICAL** | `Dockerfile` / `server/storage.ts` | DF:34, storage:25-29 | Добавить автоматическое создание таблиц при старте. Варианты: (a) добавить `import { migrate } from "drizzle-orm/better-sqlite3/migrator"` и вызвать при старте; (b) добавить raw SQL `CREATE TABLE IF NOT EXISTS` в storage.ts; (c) добавить скрипт миграции в CMD Docker |
| C1 | **CRITICAL** | `server/storage.ts` | 206-212, 276-281, 298-397 | Передать `tx` параметром в `buildGameState(game, tx?)` или вынести вызов `buildGameState` за пределы `db.transaction()` (вернуть из транзакции нужные данные, потом собрать state) |
| I1 | IMPORTANT | `client/src/lib/types.ts` | 31 | Удалить `dartsInTurn: number;` из `recentHistory` |
| I2 | IMPORTANT | `client/src/lib/types.ts` | после строки 22 | Добавить `currentTurn: {...} \| null;` или зафиксировать что фронтенд его не использует |
| I3 | IMPORTANT | `client/src/pages/GamePage.tsx` | 102 | Добавить `confirmTurn` в dependency array `onThrow`, либо использовать `useRef` |
| I7 | IMPORTANT | `client/src/components/game/DartboardSVG.tsx` | 71-73 | Highlight обоих single-зон: inner (R_BULL→R_INNER_SINGLE) и outer (R_TRIPLE_OUTER→R_OUTER_SINGLE) |
| M2 | MINOR | `client/src/pages/not-found.tsx` | 6,10,11,14 | Заменить hardcoded цвета на семантические CSS variables |
| M8 | MINOR | `docker-compose.yml` | 1 | Удалить `version: "3.8"` |

### Что проверено и работает корректно:

- **Drizzle ORM**: Синхронные `.get()/.all()/.run()` — используются правильно, нет async/await на синхронных операциях
- **Транзакции**: `db.transaction()` используется для атомарных операций — корректно
- **Bust/Win логика**: Итеративная проверка (`isBustCheck`) корректно обрабатывает все edge cases (score < 0, score === 1, score === 0 без double)
- **Long polling**: `req.on("close")` cleanup, `clearTimeout`, `res.headersSent` check — race conditions обработаны
- **Zod валидация**: `createGameSchema` и `submitTurnSchema` покрывают все невалидные входы, включая Triple Bull, miss с multiplier > 0
- **React Query v5**: Используется object form (`useQuery({ queryKey, queryFn })`) — корректно
- **`apiRequest`**: Отправляет `X-Visitor-Id` в каждом запросе — корректно  
- **`useHashLocation`**: Используется для роутинга через `wouter/use-hash-location` — корректно
- **Нет localStorage/sessionStorage/cookies**: Подтверждено — visitorId хранится только в памяти (module-level variable)
- **AnimatePresence**: Корректно используется в PlayerScoreboard, ThrowHistory, BustOverlay, WinOverlay
- **Docker multi-stage build**: Корректно — builder stage + production stage с `--omit=dev`
- **Volume**: `/app/data` монтируется через named volume `darts-data`
- **Адаптивность**: `grid-cols-1 lg:grid-cols-2`, `min-h-[44px]` для touch targets, `max-w-[360px]` для dartboard — корректно
