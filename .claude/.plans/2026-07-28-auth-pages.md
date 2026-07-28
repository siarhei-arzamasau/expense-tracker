# Страницы регистрации и входа на shadcn + сброс пароля

## Требование

> create plan for implementation of registration and log in page. For UI use shadcn components.
> User should have possibility to register via email and password, also login via email and
> password, and reset password if user forget it. On UI should be functionality to switch between
> registration and login forms.

Разбор по пунктам — важно, что три из четырёх пунктов на бэкенде **уже сделаны**:

| Пункт требования              | Бэкенд                                      | Фронтенд                 |
| ----------------------------- | ------------------------------------------- | ------------------------ |
| Регистрация по email + паролю | есть: `POST /api/auth/register`, не трогаем | новая форма              |
| Вход по email + паролю        | есть: `POST /api/auth/login`, не трогаем    | переписывается на shadcn |
| Переключение между формами    | —                                           | новое: `Tabs`            |
| Сброс забытого пароля         | **нет вообще**: ни модели, ни эндпоинтов    | две новые страницы       |

Единственная новая функциональность — сброс пароля. Всё остальное — UI поверх готового API.

## Context

`RegisterDto`, `LoginDto`, `AuthController`, путь через шины в `UsersService` с argon2 — всё это
работает и покрыто тестами. Страница `/login` (`apps/frontend/src/app/login/page.tsx`, 99 строк)
написана руками на инлайновых Tailwind-классах: `<input>`, `<button>`, `<label>` без компонентов.

shadcn **сконфигурирован, но не установлен**: `apps/frontend/components.json` есть (стиль
`new-york`, `baseColor: neutral`, `cssVariables: true`), все токены темы объявлены в
`src/app/globals.css` (`:root` + `.dark` + `@theme inline`) — существующая страница входа уже
пользуется `border-input`, `text-destructive`, `bg-primary`. При этом `src/components/ui/`
содержит только `.gitkeep`. То есть **работы по CSS нет вообще**, нужен только `shadcn add`.

Сброса пароля нет ни в одном слое: в `schema.prisma` нет модели токена, в `AuthController` нет
эндпоинтов, в проекте нет ни одной почтовой зависимости, а `docker-compose.yml` поднимает только
Postgres.

## Ключевые решения (и почему)

**Ссылка для сброса пишется в лог бэкенда, письма не отправляются.** Подтверждено пользователем.
`POST /api/auth/forgot-password` логирует готовый URL через Nest `Logger`, разработчик копирует
его из терминала. Ноль новых зависимостей, ноль новых сервисов в compose, токен вообще не уходит
из процесса. Это ровно та же линия «осознанных упрощений учебного шаблона», что уже задокументирована
в README для токена в `localStorage` и отсутствия rate limiting. Альтернатива с Mailpit + nodemailer
рассматривалась и отклонена как расширение объёма.

**Токен в ответе HTTP не возвращается.** Неаутентифицированный эндпоинт, выдающий любому желающему
токен сброса пароля по чужому email, — это примитив для захвата аккаунта, качественно хуже всех
упрощений, которые шаблон уже за собой признал.

**`forgot-password` отвечает `204` независимо от того, есть такой email или нет.** В `AuthService.login`
это решение уже принято и прокомментировано («одно сообщение и на неизвестный email, и на неверный
пароль, чтобы ответ не раскрывал, какие email зарегистрированы»). Раскрыть базу email на новом
эндпоинте означало бы сломать уже заявленное свойство системы.

**В колонке хранится SHA-256 токена, а не argon2-хэш.** Рядом с `passwordHash` это выглядит как
ошибка, поэтому: токен — 32 случайных байта из `crypto.randomBytes`, он не угадывается, и медленный
KDF ему не нужен. Решает другое: argon2 солит каждый хэш отдельно, поэтому **найти строку по токену**
было бы можно только перебором всех строк с `argon2.verify` на каждой. SHA-256 детерминирован,
поэтому колонка получает `@unique` и ищется одним индексным запросом.

**Токен одноразовый за счёт удаления, а не колонки `usedAt`.** После успешного сброса все токены
пользователя удаляются; при новом запросе сброса старые тоже удаляются, так что живая ссылка всегда
одна. Колонка `usedAt` была бы мёртвым весом: состояния «использован» и «не существует» дают
**одно и то же** сообщение об ошибке, различать их не нужно и не хочется.

**Сброс пароля — своя команда, `ChangeUserPasswordCommand` переиспользовать нельзя.** Та требует
`currentPassword` (см. `UsersService.assertPassword`), а это именно то, чего у пользователя нет.

**Ссылку составляет и логирует хендлер, а не `AuthService`, и через шину секрет не идёт.**
`RequestPasswordResetCommand` возвращает `void`; `ConfigService` и `Logger` инжектятся в
`RequestPasswordResetHandler`, сырой токен живёт только между `UsersService` и хендлером.
Альтернатива — вернуть токен из команды и собирать URL в `AuthService` — отклонена по двум
причинам: `AuthService` описан как «владеет токенами, и больше ничем», и там имеются в виду
**JWT**, а не строки сброса; и любой publisher с логированием, добавленный на шину позже,
получил бы токен сброса в сериализованном результате. Плата за это — хендлер перестаёт быть
чистым тонким адаптером над `UsersService` и берёт на себя доставку; это осознанно, потому что
«выдать ссылку сброса» — прикладной сценарий, и слой хендлеров ему ровно соответствует.

**Успешный сброс не выдаёт JWT.** Ответ `204`, фронтенд ведёт на `/login` с сообщением об успехе.
Выдавать токен по ссылке из почты значит превращать ссылку в полноценный вход.

**Переключение форм — `Tabs` внутри одного `Card` на существующем `/login`.** Маршрут переиспользуется,
поэтому ссылка «Log in» в `src/app/page.tsx` продолжает работать. Страницы сброса всё равно нужны
отдельными маршрутами — по ссылке из лога надо куда-то попасть, вкладкой это не выражается.

**Активная вкладка хранится в `useState`, а не в URL.** `useSearchParams` в клиентском компоненте
Next 16 требует границы `Suspense`, и платить этим за возможность сослаться на вкладку регистрации
незачем. На `/reset-password` `useSearchParams` неизбежен — там `Suspense` и будет (см. «Ловушки»).

**shadcn ставится только под страницы аутентификации.** Это сознательный разворот решения из
`2026-07-28-category-management.md` («Ставить shadcn ради этой фичи — расширение объёма»): теперь
компоненты просит само требование. `/categories` (392 строки) и `/expenses` остаются на рукописных
классах. В кодовой базе временно живут две идиомы — это граница объёма, а не недоделка;
зафиксировать её в CLAUDE.md.

## Схема и миграция

```prisma
model PasswordResetToken {
  id String @id @default(uuid(7))

  /// SHA-256 от токена, а не argon2: колонку надо ИСКАТЬ по значению, а argon2
  /// солит каждый хэш и потребовал бы перебора всех строк.
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```

В `model User` добавляется обратная связь `passwordResetTokens PasswordResetToken[]`.

Миграция — обычная, генерируется целиком: `pnpm --filter @expense-tracker/database exec prisma
migrate dev --name add_password_reset_tokens`. Руками SQL править **не нужно** — это добавление
таблицы, а не переименование колонки (случай
`20260728035150_rename_password_to_password_hash` не повторяется).

Время жизни — 60 минут, константой `PASSWORD_RESET_TTL_MINUTES` в `users.service.ts`. В env не
выносится: в учебном шаблоне это значение не варьируется по окружениям.

## Контракт типов — `packages/shared`

`src/types/auth.ts`:

```ts
export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}
```

`src/constants/api-routes.ts` — в блок `auth`:

```ts
forgotPassword: "auth/forgot-password",
resetPassword: "auth/reset-password",
```

Правила валидации сюда **не** дублируются (CLAUDE.md): они живут в `class-validator`-DTO на бэкенде
и в zod-схемах на фронтенде.

## Контракт сообщений

| Сообщение                     | Полезная нагрузка    | Результат | Исключения хендлера   |
| ----------------------------- | -------------------- | --------- | --------------------- |
| `RequestPasswordResetCommand` | `email`              | `void`    | —                     |
| `ResetUserPasswordCommand`    | `token, newPassword` | `void`    | `BadRequestException` |

`RequestPasswordResetCommand` возвращает `void` при любом исходе: неизвестный email — не ошибка,
а один из двух нормальных путей. Внутри хендлера `UsersService.createPasswordResetToken` отдаёт
`string | null` (по образцу `VerifyUserCredentialsQuery`), и хендлер сам решает — собрать URL и
записать его в лог или записать пометку, что email неизвестен. Наружу разница не видна.

`ResetUserPasswordCommand` **несёт пароль в открытом виде** и пополняет список из CLAUDE.md:
любой publisher с логированием или трейсингом обязан редактировать это поле.
`RequestPasswordResetCommand` в этот список не попадает — в ней только email, а токен на шину
не выходит вовсе (см. «Ключевые решения»).

Оба хендлера добавляются в `USERS_COMMAND_HANDLERS`
(`src/users/commands/handlers/index.ts`). `tsc` пропуск не заметит — упадёт рантайм с
`CommandHandlerNotFoundException`; ловит это `users.cqrs.spec.ts`.

## Эндпоинты

Оба **без** `JwtAuthGuard` — пользователь по определению не аутентифицирован.

| Метод  | Путь                        | Тело                  | Ответ                             |
| ------ | --------------------------- | --------------------- | --------------------------------- |
| `POST` | `/api/auth/forgot-password` | `{ email }`           | `204` всегда                      |
| `POST` | `/api/auth/reset-password`  | `{ token, password }` | `204`, либо `400` на плохой токен |

DTO — `class-validator`:

- `ForgotPasswordDto`: `@IsEmail()`
- `ResetPasswordDto`: `@IsString() @Length(43, 43)` для `token` — `base64url` от 32 байт всегда
  ровно 43 символа, так что границы известны точно и `{"token":"a"}` до запроса в базу не дойдёт;
  для `password` —
  `@MinLength(8) @MaxLength(72)` теми же сообщениями, что в `RegisterDto`, чтобы пароль, который
  можно задать при регистрации, можно было задать и при сбросе

Одно сообщение на все причины отказа: `"Reset link is invalid or has expired"` — истёк, уже
использован и никогда не существовал неразличимы.

## Файлы

**`packages/database`**

- `prisma/schema.prisma` — модель `PasswordResetToken`, обратная связь в `User`
- `prisma/migrations/<timestamp>_add_password_reset_tokens/migration.sql` — генерируется как есть

**`packages/shared`**

- `src/types/auth.ts` — `ForgotPasswordInput`, `ResetPasswordInput`
- `src/constants/api-routes.ts` — `auth.forgotPassword`, `auth.resetPassword`

**`apps/backend`**

- `src/auth/dto/forgot-password.dto.ts`, `src/auth/dto/reset-password.dto.ts` — новые
- `src/auth/auth.controller.ts` — два `@Post` с `@HttpCode(HttpStatus.NO_CONTENT)`; DTO
  импортируются **как значения** (`ValidationPipe` читает их из `emitDecoratorMetadata`)
- `src/auth/auth.service.ts` — два метода-проброса на шину, `requestPasswordReset` и
  `resetPassword`. Ни Prisma, ни argon2, ни `ConfigService`, ни `Logger` здесь не появляются:
  сборка URL живёт в хендлере
- `src/users/password-reset-token.repository.ts` — новый. Отдельный от `UsersRepository`, чья
  docstring говорит «единственное место, где таблица `users` встречается с Prisma»:
  `create`, `findByTokenHash`, `deleteById`, `deleteAllForUser` + `interface PasswordResetTokenRecord`
- `src/users/users.service.ts` — `createPasswordResetToken(email)` и `resetPassword(token, newPassword)`
- `src/users/users.module.ts` — новый репозиторий в `providers` (в `exports` — нет, у модуля их нет)
- `src/users/commands/request-password-reset.command.ts`, `reset-user-password.command.ts` — новые
- `src/users/commands/handlers/request-password-reset.handler.ts` — новый; единственный хендлер,
  который не является тонким адаптером: инжектит `ConfigService`, держит
  `private readonly logger = new Logger(...)` и собирает `${WEB_APP_URL}/reset-password?token=…`
- `src/users/commands/handlers/reset-user-password.handler.ts` — новый, тонкий адаптер
- `src/users/commands/handlers/index.ts` — оба в `USERS_COMMAND_HANDLERS` и в реэкспорт
- `src/users/users.service.spec.ts`, `src/users/users.cqrs.spec.ts`, `src/auth/auth.service.spec.ts` — дополняются
- `test/app.e2e-spec.ts` — `204` на неизвестный email, `400` на мусорный токен

**`apps/frontend`**

- `package.json` — примитивы Radix, которые притянет `shadcn add`: нужны slot (button),
  label (label, form) и tabs (tabs). **Точный список сверяем по выводу команды, а не по памяти:**
  shadcn перешёл с отдельных `@radix-ui/react-*` на единый пакет `radix-ui`, и что именно
  придёт, зависит от версии CLI. Остальное — `react-hook-form`, `zod`, `@hookform/resolvers`,
  `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` — **уже стоит**
- `src/components/ui/{button,input,label,card,tabs,form,alert}.tsx` — генерируются CLI
- `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx` — новые.
  Вынесены из страницы намеренно: `categories/page.tsx` разросся до 392 строк, повторять не надо
- `src/lib/validation/auth.ts` — новый: zod-схемы всех четырёх форм в одном месте
- `src/lib/queries/auth.ts` — новый: функции мутаций по образцу `lib/queries/categories.ts`
- `src/app/login/page.tsx` — переписывается: `Card` + `Tabs`, формы из компонентов
- `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` — новые
- `src/app/page.tsx` — подпись ссылки «Log in» → «Log in / Register»
- `src/app/categories/page.tsx`, `src/app/expenses/page.tsx` — плюс `authStorage.clear()` перед
  `router.push("/login")` на 401 (см. «Ловушки»), больше ничего

**Корень**

- `.env.example` — `WEB_APP_URL=http://localhost:3000`
- `README.md` — флоу сброса и его упрощения
- `CLAUDE.md` — решение про SHA-256 и граница «shadcn только в auth»

Переиспользуется: `apiClient` / `ApiError` (`src/lib/api-client.ts`), `authStorage`,
паттерн `useForm` + `zodResolver`, `PrismaService`, `UsersRepository`.

## Поведение фронтенда

**`/login`** (`"use client"`) — `Card` шириной `max-w-sm` по центру, внутри `Tabs` с
`TabsList` из двух `TabsTrigger`: «Log in» и «Register». Активная вкладка — `useState`.

- **`LoginForm`** — email, пароль, ссылка «Forgot password?» на `/forgot-password`.
  Успех → `authStorage.set(accessToken)` → `router.push("/expenses")`. Дефолты
  `demo@example.com` / `password123` сохраняются: они полезны и упомянуты в README
- **`RegisterForm`** — имя (опционально), email, пароль, подтверждение пароля. Успех
  ведёт себя ровно как вход: `POST /auth/register` уже возвращает `AuthResponse` с токеном
- Ошибки — в `Alert` с `variant="destructive"` и `role="alert"`. Toast-хост в
  `providers.tsx` отсутствует, и `sonner` ради этого не ставится

**`/forgot-password`** — одно поле email. После `204` форма заменяется на `Alert`:
«Если аккаунт с таким email существует, ссылка для сброса отправлена» — формулировка не
подтверждает существование аккаунта, иначе `204`-без-утечки на бэкенде обессмысливается.
Рядом — подсказка, что в учебном режиме ссылка лежит в логе бэкенда.

**`/reset-password`** — читает `?token=` через `useSearchParams`, поля «новый пароль» и
«подтверждение». Успех → `router.push("/login")` с сообщением. Токен уходит только в теле
POST, в query он присутствует лишь потому, что ссылка обязана быть ссылкой.

zod-схемы повторяют границы DTO (`min(8)`, `max(72)`, `max(100)` для имени) и добавляют то,
чего на бэкенде нет и не нужно: `.refine` на совпадение пароля и подтверждения. Как в
существующем `login/page.tsx`, используется `z.string().email()`, а не `z.email()` — валидно
и в Zod 3, и в Zod 4.

## Порядок работ

1. **Бэкенд, схема:** модель → `pnpm db:migrate` → `pnpm db:generate`
2. **`packages/shared`:** типы и маршруты (без этого фронтенд не скомпилируется)
3. **Бэкенд, слой данных:** `password-reset-token.repository.ts` → два метода в `UsersService`
4. **Бэкенд, CQRS:** команды → хендлеры → регистрация в `USERS_COMMAND_HANDLERS`
5. **Бэкенд, HTTP:** DTO → `AuthService` → `AuthController`
6. **Бэкенд, тесты:** `users.service.spec` → `users.cqrs.spec` → `auth.service.spec` → e2e
7. **Фронтенд, компоненты** — из `apps/frontend`, а не из корня: CLI ищет `components.json`
   в рабочем каталоге, и `pnpm --filter … dlx` не существует как форма команды.

   ```bash
   cd apps/frontend
   pnpm dlx shadcn@latest add button input label card tabs form alert
   cd ../.. && pnpm format
   ```

8. **Фронтенд, код:** `lib/validation/auth.ts` → `lib/queries/auth.ts` → формы → три страницы
9. **Документация:** `.env.example`, README, CLAUDE.md

## Ловушки

- **`useSearchParams` на `/reset-password` требует `Suspense`.** В Next 16 клиентский компонент,
  читающий search params, при статическом рендере обязан быть под границей `Suspense`, иначе
  `next build` падает. Форму заворачиваем в `<Suspense fallback={…}>` внутри страницы; ставить
  `export const dynamic = "force-dynamic"` на всю страницу — лишнее.
- **`WEB_APP_URL` читаем через `config.get("WEB_APP_URL", "http://localhost:3000")`, а не
  `getOrThrow`.** `getOrThrow` уронит бэкенд на старте у всех, чей `.env` скопирован до этой
  правки. Для `JWT_SECRET` `getOrThrow` уместен, для URL с очевидным дефолтом — нет.
- **`.env.example` лежит в каталоге, закрытом настройками доступа** — я его не читал и не правил.
  Строку `WEB_APP_URL=http://localhost:3000` придётся добавить вручную либо разрешить доступ.
- **`resetPassword` делает две записи без транзакции.** Обновление `passwordHash` и удаление
  токенов пользователя — два запроса. Если первый прошёл, а второй упал, ссылка останется живой
  и будет работать против **нового** пароля. Оборачиваем в `this.prisma.$transaction([...])`
  на уровне репозитория/сервиса; молча оставлять это окно нельзя.
- **`import type` ломает Nest DI.** `ForgotPasswordDto` / `ResetPasswordDto` в `@Body()`,
  `ConfigService` в конструкторе хендлера, репозиторий в конструкторе сервиса,
  классы команд в `@CommandHandler(...)` —
  всё это импорты-значения. Ошибка вылезет не в типах, а как «Nest can't resolve dependencies»
  при старте. `typescript/consistent-type-imports` в проекте выключен именно поэтому.
- **`CqrsModule` регистрирует хендлеры в `onApplicationBootstrap`.** В `users.cqrs.spec.ts`
  обязателен `await moduleRef.init()` до первого `execute()`, иначе шина пуста.
- **`shadcn add` пишет файлы не по правилам oxfmt.** `pnpm format:check` — часть зелёного
  базового состояния, поэтому `pnpm format` идёт сразу после генерации, до любых правок.
- **`minimumReleaseAge` может заблокировать свежие пакеты Radix.** В `pnpm-workspace.yaml` уже
  есть `minimumReleaseAgeExclude`, дописанный самим pnpm. Если установка упрётся в возраст
  релиза, pnpm скажет об этом и допишет туда же — не «обходить» правкой версий вслепую.
  Postinstall-скриптов у Radix нет, так что запись в `allowBuilds` не нужна.
- **`authStorage.clear()` в проекте не вызывается нигде.** CLAUDE.md утверждает, что фронтенд
  «сбрасывает сохранённый токен на 401 и больше ни на чём», но `categories/page.tsx:213-214` и
  `expenses/page.tsx:35-38` только делают `router.push("/login")`, оставляя мёртвый токен в
  `localStorage`. Правка на две строки, и делается здесь: страница входа, на которую ведёт
  этот редирект, — предмет этой задачи, а расхождение документации с кодом чинить дешевле
  сейчас, чем объяснять позже.
- **`UsersService` уже ~150 строк**, два новых метода доводят его примерно до 190. Пока
  терпимо; если добавится третий сценарий с токенами, логику стоит вынести отдельным сервисом.

## Тесты

- **`users.service.spec.ts`** (мок-репозитории, по образцу существующих кейсов):
  - `createPasswordResetToken` на неизвестный email → `null`, в репозиторий ничего не пишется
  - на известный → возвращён сырой токен, а в репозиторий ушёл **не он**, а его SHA-256
    (проверяем ровно как для пароля: наружу секрет, в базу — хэш)
  - предыдущие токены пользователя удалены до создания нового
  - `resetPassword` с неизвестным `tokenHash` → `BadRequestException`
  - с истёкшим `expiresAt` → `BadRequestException`, и строка удалена
  - успех → в `users.update` уходит argon2-хэш нового пароля, токены пользователя удалены
  - повторный вызов с тем же токеном → `BadRequestException` (одноразовость)
- **`users.cqrs.spec.ts`** — оба новых сообщения через шину; единственный тест, который ловит
  незарегистрированный хендлер
- **`auth.service.spec.ts`** — мок `CommandBus`: `requestPasswordReset` для неизвестного email
  завершается **без ошибки** и отдаёт тот же результат, что для известного (доказательство
  отсутствия перечисления email)
- **`request-password-reset.handler.spec.ts`** — мок `UsersService` + `ConfigService` и шпион на
  `Logger`: для известного email в лог уходит URL, содержащий `WEB_APP_URL` и токен; для
  неизвестного — URL **не** логируется. Это тест на доставку, поэтому живёт рядом с хендлером,
  а не в `auth.service.spec.ts`
- **`test/app.e2e-spec.ts`** — `POST /api/auth/forgot-password` с незарегистрированным email → `204`;
  `POST /api/auth/reset-password` с мусорным токеном → `400`
- Фронтенд-тестов нет: инфраструктуры для них в проекте не существует, и заводить её здесь
  — отдельная задача

## Верификация

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check && pnpm build
docker compose up -d
pnpm db:migrate && pnpm db:generate && pnpm db:seed
pnpm --filter @expense-tracker/backend test:e2e
```

Приёмка вручную (`pnpm dev`, фронтенд на http://localhost:3000).

**Сценарий сброса гоняем на одноразовом аккаунте, а не на `demo@example.com`.** `seed.ts`
делает `upsert` с `update: {}`, то есть повторный `pnpm db:seed` существующему пользователю
пароль **не восстанавливает**. Сбросив демо-пароль, вернуть задокументированный в README
`password123` можно будет только удалив пользователя. Поэтому шаг 3 создаёт `reset-test@example.com`,
и шаги 6–10 идут на нём.

1. `/login` показывает две вкладки; переключение сохраняет введённое в каждой форме
2. Вход `demo@example.com` / `password123` → `/expenses` (регресс не внесён)
3. Регистрация `reset-test@example.com` → сразу залогинен и на `/expenses`; тот же email
   второй раз → 409 с внятным текстом в `Alert`
4. Пароль в 7 символов **отклоняется** на клиенте, запроса нет; отправка того же в Swagger —
   `400` от DTO (границы клиента и бэкенда совпадают)
5. Несовпадающее подтверждение пароля → ошибка поля, запроса нет
6. `/forgot-password` с `reset-test@example.com` → `204`, в логе бэкенда ссылка
   `http://localhost:3000/reset-password?token=…`
7. Тот же экран с заведомо отсутствующим email → **тот же** ответ и то же сообщение на экране,
   в логе пометка, что email неизвестен, и **никакого URL** (отсутствие перечисления email)
8. Переход по ссылке → новый пароль → `/login`; вход со **старым** паролем `401`, с новым — успех
9. Повторный переход по той же ссылке → «Reset link is invalid or has expired»
10. Запрос второй ссылки делает первую нерабочей (живая ссылка одна)
11. `psql` → `\d password_reset_tokens`: `tokenHash` уникален, колонки `usedAt` нет
12. `DELETE /api/users/me` для `reset-test@example.com` уносит его токены каскадом
    (и заодно убирает тестовый аккаунт)
13. Вход `demo@example.com` / `password123` всё ещё работает — демо-аккаунт не задет
14. Тёмная тема: `<html class="dark">` — карточка, вкладки и `Alert` читаемы (токены `.dark` есть)
15. `/categories` и `/expenses` выглядят как раньше — рукописные классы не задеты

## Вне объёма

- **Писем не отправляем.** Ни nodemailer, ни Mailpit, ни сервиса в `docker-compose.yml`.
  Доставка ссылки — лог бэкенда. Зафиксировать в README как упрощение шаблона.
- **Rate limiting на `forgot-password` не вводим** — согласуется с уже задокументированным
  отсутствием rate limiting на входе. Отметить как известное ограничение, а не забыть.
- **Чистки просроченных токенов по расписанию нет.** Cron/scheduler в проект не добавляется;
  токены незавершённых сценариев остаются в таблице до удаления пользователя. Для шаблона
  это шум, а не проблема.
- **Верификации email при регистрации нет** — требование её не просит, а вся почтовая
  инфраструктура для неё отсутствует по решению выше.
- **`/categories` и `/expenses` на shadcn не переписываются.** Две идиомы в кодовой базе
  остаются сознательно; граница описана в CLAUDE.md.
- **Отзыва токенов, refresh-ротации, ролей, httpOnly-cookie нет** — CLAUDE.md и README
  фиксируют это как осознанные упрощения. Сброс пароля **не** инвалидирует ранее выданные
  JWT: механизма отзыва не существует, старый токен доживёт до истечения срока.
  Это надо назвать в README прямо — от смены пароля пользователь ждёт обратного.
- **Навигации и разлогина в приложении по-прежнему нет.** `authStorage.clear()` появляется
  только на пути обработки 401; кнопка «Log out» — отдельная задача.
