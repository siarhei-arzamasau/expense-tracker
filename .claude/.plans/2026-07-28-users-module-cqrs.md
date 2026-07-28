# Users module + CQRS для межмодульного взаимодействия

## Context

JWT-авторизация в репозитории **уже реализована и работает**: `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/me`, `JwtStrategy`, `JwtAuthGuard`, `@CurrentUser()`,
argon2-хэширование, модель `User`. Скаффолд обогнал шаг курса.

Чего нет и что нужно сделать:

1. **Слой пользователя отсутствует** — `AuthService` инжектит `PrismaService` напрямую.
   Нужны `UsersRepository` (доступ к данным) и `UsersService` (бизнес-правила).
2. **Нет эндпоинтов управления аккаунтом** — профиль, смена пароля, удаление.
3. **Поле называется `password`, хотя хранит хэш** — переименовать в `passwordHash`.
4. **Межмодульное взаимодействие делаем через CQRS** (`@nestjs/cqrs@11.0.3`): `AuthModule`
   больше не импортирует `UsersModule` и не инжектит `UsersService` — только шины.

Результат: `AuthModule` не знает ни о Prisma, ни о `UsersService`; единственная точка входа
в пользовательский модуль — команды и запросы. Публичный контракт API не ломается,
фронтенд продолжает работать без изменений.

## Ключевые решения (и почему)

**Хендлеры — транспортные адаптеры, доменная логика в `UsersService`.** Хендлер
разворачивает сообщение и вызывает метод сервиса. Это позволяет юнит-тестировать логику
без шины, и `UsersService` не вырождается в pass-through: в нём argon2, проверки конфликтов
email и маппинг в `UserDto`, общие для нескольких хендлеров.

**`UsersModule` НЕ экспортирует `UsersService`.** В этом смысл упражнения. Проверено:
`AuthService` не инжектится ни в один другой модуль, `JwtAuthGuard`/`@CurrentUser()`
импортируются файлово (см. `apps/backend/src/expenses/expenses.controller.ts:17`), поэтому
запрет на экспорт ничего не ломает.

**`CqrsModule.forRoot()` в `AppModule`.** Проверено по исходникам 11.0.3: `forRoot()`
возвращает модуль с `global: true`, голый `CqrsModule` — нет. Смешивать два способа —
получить невнятное `Nest can't resolve CommandBus` при старте. Глобальная регистрация
согласуется с уже глобальными `PrismaModule` и `ConfigModule`.

**Пароль в открытом виде идёт по шине — это принято осознанно.** `CommandBus.execute` и
`QueryBus.execute` вызывают `publisher.publish(message)` для каждого сообщения. Пароль несут
`RegisterUserCommand`, `ChangeUserPasswordCommand`, `DeleteUserCommand` и
`VerifyUserCredentialsQuery` — обходить это точечно бессмысленно. Каждый такой класс
получает комментарий-предупреждение: при добавлении логирующего publisher эти поля
обязаны редактироваться.

**`GetUserByIdQuery` возвращает `UserDto | null`, а не бросает `NotFoundException`.**
`/auth/me` обязан отдавать **401** на токен несуществующего пользователя: фронтенд
разлогинивает именно по 401 (`ApiError.isUnauthorized`, `apps/frontend/src/lib/api-client.ts:14`).
HTTP-семантику выбирает вызывающий модуль, а не хендлер.

**`VerifyUserCredentialsQuery` — именно query.** Побочных эффектов нет: argon2-сравнение
и возврат. Возвращает `UserDto | null`; `UnauthorizedException("Invalid email or password")`
бросает `AuthService`, потому что он владеет эндпоинтом.

**Событий (EventBus) нет, `lastLoginAt` нет.** События без подписчиков — мёртвый код;
запись `lastLoginAt` при логине была бы побочным эффектом в query, что ломает
разделение command/query.

## Целевая структура

```
apps/backend/src/users/
  users.module.ts             # контроллер + сервис + репозиторий + хендлеры; НИЧЕГО не экспортирует
  users.controller.ts         # HTTP, всё под JwtAuthGuard, диспатчит в шины
  users.service.ts            # argon2, конфликты email, маппинг в UserDto
  users.repository.ts         # единственное место, где users-таблица трогает Prisma
  dto/{update-profile,change-password,delete-account}.dto.ts
  commands/                   # ← публичный контракт модуля
    {register-user,update-user-profile,change-user-password,delete-user}.command.ts
    handlers/*.handler.ts + index.ts (USERS_COMMAND_HANDLERS)
  queries/                    # ← публичный контракт модуля
    {get-user-by-id,verify-user-credentials}.query.ts
    handlers/*.handler.ts + index.ts (USERS_QUERY_HANDLERS)
  users.service.spec.ts
  users.cqrs.spec.ts
```

`commands/` и `queries/` — единственное, что другим модулям разрешено импортировать.
`AuthModule` импортирует оттуда классы сообщений (обычный TS-импорт, не Nest-импорт модуля),
поэтому DI-цикла не возникает.

## Контракт сообщений

Типобезопасность через базовые классы `Command<R>` / `Query<TResult>` из `@nestjs/cqrs`
(проверено в 11.0.3): `commandBus.execute(new RegisterUserCommand(...))` выводит `UserDto`
без явных generic-параметров.

| Сообщение                    | Полезная нагрузка                      | Результат         | Исключения хендлера                          |
| ---------------------------- | -------------------------------------- | ----------------- | -------------------------------------------- |
| `RegisterUserCommand`        | `email, password, name?`               | `UserDto`         | `ConflictException`                          |
| `UpdateUserProfileCommand`   | `userId, name?, email?`                | `UserDto`         | `ConflictException`, `NotFoundException`     |
| `ChangeUserPasswordCommand`  | `userId, currentPassword, newPassword` | `void`            | `UnauthorizedException`, `NotFoundException` |
| `DeleteUserCommand`          | `userId, password`                     | `void`            | `UnauthorizedException`, `NotFoundException` |
| `GetUserByIdQuery`           | `userId`                               | `UserDto \| null` | —                                            |
| `VerifyUserCredentialsQuery` | `email, password`                      | `UserDto \| null` | —                                            |

Хэш пароля **никогда не покидает `UsersService`**: наружу отдаётся только `UserDto`.

## Эндпоинты

Все под `JwtAuthGuard`, `userId` — только из `@CurrentUser()`, из тела запроса никогда.
`GET /api/auth/me` остаётся как есть, дублирующий `GET /users/me` не добавляется.

| Метод    | Путь                     | Тело                               | Ответ             |
| -------- | ------------------------ | ---------------------------------- | ----------------- |
| `PATCH`  | `/api/users/me`          | `{ name?, email? }`                | `200` + `UserDto` |
| `PATCH`  | `/api/users/me/password` | `{ currentPassword, newPassword }` | `204`             |
| `DELETE` | `/api/users/me`          | `{ password }`                     | `204`             |

Валидация — `class-validator` DTO (по CLAUDE.md; в `packages/shared` правила не дублируются):
`@IsEmail`, `@MinLength(8) @MaxLength(72)` для `newPassword`, `@MaxLength(100)` для `name`.
В `UpdateProfileDto` оба поля опциональны, но пустое тело отвергается — иначе PATCH без полей
молча вернёт 200.

## Файлы

**`packages/database`**

- `prisma/schema.prisma:32` — `password` → `passwordHash`
- `prisma/migrations/<timestamp>_rename_password_to_password_hash/migration.sql` — новый,
  SQL правится вручную (см. ниже)
- `prisma/seed.ts:53` — `password:` → `passwordHash:`

**`packages/shared`**

- `src/types/user.ts` — новый: сюда переезжает `UserDto` из `types/auth.ts`, добавляются
  `UpdateProfileInput`, `ChangePasswordInput`, `DeleteAccountInput`. Реэкспорт идёт через
  `export *` в `src/index.ts`, поэтому внешние импорты `UserDto` не ломаются.
- `src/types/auth.ts` — убрать `UserDto`, импортировать его из `./user` для `AuthResponse`
- `src/index.ts` — `export * from "./types/user"`
- `src/constants/api-routes.ts` — блок `users: { me: "users/me", password: "users/me/password" }`

**`apps/backend`**

- `package.json` — зависимость `@nestjs/cqrs` `^11.0.3` (peer deps совместимы с Nest 11 / rxjs ^7.8.2)
- `src/app.module.ts` — `CqrsModule.forRoot()` и `UsersModule` в `imports`
- `src/users/**` — всё новое, по структуре выше
- `src/auth/auth.service.ts` — инжектит `CommandBus` + `QueryBus` вместо `PrismaService`;
  `register` → `RegisterUserCommand`, `login` → `VerifyUserCredentialsQuery`,
  `findById` → `GetUserByIdQuery` + `UnauthorizedException` при `null`.
  argon2 и Prisma из файла уходят полностью.
- `src/auth/auth.module.ts` — импорт `UsersModule` не добавляется (шины глобальны)
- `src/auth/auth.service.spec.ts` — новый
- `test/app.e2e-spec.ts` — добавить проверки 401 без токена на `PATCH /api/users/me` и
  `DELETE /api/users/me`

**Что переиспользуется, а не пишется заново:** `JwtAuthGuard`
(`src/auth/guards/jwt-auth.guard.ts`), `@CurrentUser()`
(`src/auth/decorators/current-user.decorator.ts`), `AuthenticatedUser` (`src/auth/types.ts`),
`PrismaService` (`src/prisma/prisma.service.ts`, глобальный). Паттерн `interface UserRecord` +
приватный `toDto()` берётся из `src/categories/categories.service.ts:7-12,48-55`.

## Порядок работ

1. `pnpm --filter @expense-tracker/backend add @nestjs/cqrs`
2. **Миграция переименования.** Prisma по умолчанию сгенерирует `DROP COLUMN` + `ADD COLUMN`,
   что уничтожит все хэши. Поэтому:
   - правка `schema.prisma`
   - `pnpm --filter @expense-tracker/database exec prisma migrate dev --create-only --name rename_password_to_password_hash`
   - **прочитать сгенерированный `migration.sql`** и заменить его тело на
     `ALTER TABLE "users" RENAME COLUMN "password" TO "passwordHash";`
   - `pnpm db:migrate && pnpm db:generate`
   - обновить `seed.ts` и `auth.service.ts`, чтобы дерево снова компилировалось
3. `packages/shared`: `types/user.ts`, правки `auth.ts` / `index.ts` / `api-routes.ts`
4. `users/`: repository → service → команды/запросы + хендлеры → DTO → контроллер → module
5. Перевод `AuthService` на шины
6. Тесты

## Ловушки

- **`import type` ломает Nest DI.** Всё, что стоит в сигнатуре конструктора или в `@Body()`,
  импортируется как значение: `import { CommandBus }`, `import { UsersRepository }`,
  `import { UpdateProfileDto }`. Ошибка проявится не на типизации, а как
  "Nest can't resolve dependencies" при старте (CLAUDE.md фиксирует это отдельно).
  Класс команды в `@CommandHandler(RegisterUserCommand)` — тоже значение.
- **Хендлеры регистрируются на `onApplicationBootstrap`** через `ExplorerService`. В тестах,
  где не вызван `init()`, шина их не увидит и упадёт с `CommandHandlerNotFoundException`.
- **`apiClient.delete`** (`apps/frontend/src/lib/api-client.ts:64`) не умеет отправлять тело.
  Фронтенд мы не трогаем, но если `DELETE /users/me` когда-нибудь будут подключать к UI,
  хелперу понадобится параметр body.

## Тесты

- **`users.service.spec.ts`** — юнит-тесты с мок-репозиторием, по образцу
  `src/expenses/expenses.service.spec.ts` (фабрика моков + `Test.createTestingModule`):
  конфликт email при обновлении, неверный текущий пароль, успешная смена пароля
  (утверждаем, что в репозиторий уходит **хэш**, а не сырой пароль), пользователь не найден.
- **`users.cqrs.spec.ts`** — единственный тест, который ловит незарегистрированный хендлер
  (главная причина падений CQRS в рантайме). Собирает testing-модуль с `CqrsModule.forRoot()`,
  всеми хендлерами и мок-`UsersRepository`, вызывает `await moduleRef.init()` и прогоняет
  каждую команду и каждый запрос через шину.
- **`auth.service.spec.ts`** — мок `CommandBus`/`QueryBus`: register отдаёт токен,
  login на `null` от запроса даёт 401, `/auth/me` на `null` даёт 401 (не 404).
- **`test/app.e2e-spec.ts`** — плюс два кейса на 401 без токена.

## Верификация

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
docker compose up -d
pnpm db:migrate && pnpm db:generate && pnpm db:seed
pnpm --filter @expense-tracker/backend test:e2e
```

Приёмка вручную (`pnpm dev`, Swagger на http://localhost:3001/api/docs):

1. Логин `demo@example.com` / `password123` — работает после переименования колонки
   (доказывает, что миграция сохранила хэши, а не пересоздала колонку).
2. `psql` → `\d users` показывает колонку `passwordHash` и **отсутствие** `password`.
3. `GET /api/auth/me` с токеном → `UserDto`; без токена → 401.
4. `PATCH /api/users/me` со сменой имени → 200 и обновлённый `UserDto`;
   с email уже существующего пользователя → 409.
5. `PATCH /api/users/me/password` с неверным `currentPassword` → 401; с верным → 204,
   после чего логин со старым паролем даёт 401, а с новым — 200.
6. `DELETE /api/users/me` с неверным паролем → 401; с верным → 204, после чего
   `GET /api/auth/me` со старым токеном → **401**, а траты и категории удалены каскадом.
7. Фронтенд на http://localhost:3000 логинится и показывает список трат — контракт не сломан.

## Вне объёма

- `CategoriesService` / `ExpensesService` под репозитории и CQRS **не переписываются** —
  они инжектят `PrismaService` напрямую. Несогласованность останется; отметить её
  комментарием в `users.repository.ts`.
- Фронтенд не трогаем: форма `UserDto` не меняется, новые эндпоинты остаются без UI.
- Ролей, отзыва токенов, refresh-ротации и rate limiting нет — CLAUDE.md фиксирует это как
  осознанные упрощения шаблона. Следствие: **токен удалённого пользователя остаётся валидным
  до истечения срока**; запросы вернут пустые списки, так как строки удалены каскадом.
  Задокументировать как известное ограничение.
- Claim `email` в JWT устаревает после смены email. Ни одна проверка на него не опирается
  (везде `user.id`) — оставляем, с комментарием в `src/auth/types.ts`.
