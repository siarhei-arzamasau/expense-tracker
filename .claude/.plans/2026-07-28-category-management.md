# Категории трат: сущность, сервис, контроллер

## Статус

**Всё, что требует задание, уже реализовано и закоммичено в `698eb9b`.** Документ приведён
в соответствие с формулировкой задания задним числом: разделы переупорядочены под четыре
требуемых пункта, фронтендовая часть вынесена в «Сверх задания». Кода это не меняет —
несделанных пунктов требования нет.

## Требование

> Авторизация уже реализована. Теперь задача — сделать категории трат: добавить сущность
> категории с идентификатором, названием, иконкой, цветом и идентификатором пользователя,
> к которому категория привязана. Затем реализовать сервис категорий с методами создания,
> поиска, обновления и удаления всех категорий пользователя, а также контроллер с этими
> эндпоинтами, защищённый текущими гардами и валидируемый классом-валидатором.

| Пункт задания          | Где живёт                                          | Что пришлось добавить                |
| ---------------------- | -------------------------------------------------- | ------------------------------------ |
| Сущность категории     | `model Category` в `schema.prisma`                 | колонка `icon`; остальное уже было   |
| Сервис: создание       | `CategoriesService.create`                         | параметр `icon`                      |
| Сервис: поиск          | `CategoriesService.findAll`                        | `_count` и `toListItemDto`           |
| Сервис: обновление     | `CategoriesService.update`                         | **метод целиком — его не было**      |
| Сервис: удаление       | `CategoriesService.remove`                         | ничего                               |
| Контроллер под гардами | `CategoriesController`, `@UseGuards(JwtAuthGuard)` | `@Patch(":id")`                      |
| Валидация классом      | `Create`/`UpdateCategoryDto`                       | `UpdateCategoryDto`, `IsSingleEmoji` |

Два места, где формулировку легко прочитать неверно:

- **«удаление всех категорий пользователя»** — это про то, что весь CRUD ограничен категориями
  текущего пользователя, а не про массовое удаление одним запросом. Эндпоинта
  `DELETE /api/categories` нет и не планируется.
- **«иконкой, цветом»** — два отдельных nullable-поля (`icon` и `color`), а не «цвет иконки».
  `color` уже существовал в модели.

## Context

Модель `Category` существует, но пользоваться ей почти нельзя. У `CategoriesService` есть только
`findAll` / `create` / `remove` — **эндпоинта обновления нет вообще**, поэтому уже имеющуюся
колонку `color` можно задать при создании и больше никогда не изменить. Иконки нет как колонки.

Что делаем по заданию:

1. **Колонка `icon`** на `Category` — один эмодзи.
2. **`PATCH /api/categories/:id`** — редактирование имени, цвета и иконки.
3. **Класс-валидатор `IsSingleEmoji`** — правило для `icon`, которое нельзя выразить готовыми
   декораторами `class-validator`.

Сверх задания, отдельным разделом ниже: страница `/categories` и фильтр трат по категории —
без них бэкендовый CRUD в приложении никак не проявляется.

## Ключевые решения (и почему)

**Проверка уникальности в `update` обязана исключать редактируемую строку.**
`@@unique([userId, name])` означает, что переименование может столкнуться с чужим именем.
`create` уже бросает `ConflictException` — `update` повторяет проверку, но с
`if (existing && existing.id !== id)`. Без этого сохранение категории **без** смены имени
отвечает 409.

**Валидация эмодзи — через `Intl.Segmenter`, а не через `@MaxLength`.**
`class-validator` считает кодовые единицы UTF-16, а `"👨‍👩‍👧‍👦".length === 11`. Ограничение длины
отвергает большинство реальных эмодзи. Считаем графемные кластеры (Node 24 умеет `Intl.Segmenter`)
и требуем ровно один. Это и есть «класс-валидатор» из задания в буквальном смысле:
`ValidatorConstraintInterface`, а не композиция готовых декораторов.

**`expenseCount` живёт в отдельном `CategoryListItemDto`, а не в `CategoryDto`.**
_Строго говоря, счётчик выходит за рамки задания_ — он нужен подтверждению удаления и подписям
чипсов фильтра. Раз он всё-таки есть, важно, где именно: `ExpenseDto` встраивает копию категории,
и `ExpensesService.toDto` собирает этот вложенный объект руками (`expenses.service.ts:122-129`).
Обязательное поле счётчика в `CategoryDto` заставило бы считать агрегат на каждую трату впустую.
`GET /categories` отдаёт расширенный тип, вложенная копия остаётся плоской.

## Схема и миграция

`packages/database/prisma/schema.prisma`, в `model Category`:

```prisma
  /// Один эмодзи. Хранится как текст; правило — см. IsSingleEmoji в бэкенде.
  icon String?
```

Остальные поля из задания в модели уже есть: `id` (`uuid(7)`), `name`, `color`, `userId`
с `@relation(onDelete: Cascade)` и `@@unique([userId, name])`.

Поле добавляемое и nullable, поэтому `prisma migrate dev --name add_category_icon` сгенерирует
чистый `ALTER TABLE ... ADD COLUMN` и отработает без интерактивного подтверждения. Это **не**
тот случай ручного SQL, о котором предупреждает CLAUDE.md — там речь про переименование колонок.
Далее `pnpm db:generate`.

`prisma/seed.ts` — иконки сидовым категориям, и `update` в upsert расширяется, чтобы повторный
сид дозаполнил уже существующие строки:

```ts
const CATEGORIES = [
  { name: "Groceries", color: "#22c55e", icon: "🛒" },
  { name: "Transport", color: "#3b82f6", icon: "🚌" },
  { name: "Dining",    color: "#f97316", icon: "🍽️" },
  { name: "Utilities", color: "#a855f7", icon: "💡" },
];
// ...
update: { color: category.color, icon: category.icon },
```

## Контракт типов — `packages/shared/src/types/category.ts`

```ts
export interface CategoryDto {
  id: string;
  name: string;
  color: string | null;
  icon: string | null; // новое
  createdAt: string;
}

/** Только для GET /categories. Счётчик нужен подтверждению удаления и подписям
 *  чипсов фильтра; вложенная в ExpenseDto копия его сознательно НЕ несёт. */
export interface CategoryListItemDto extends CategoryDto {
  expenseCount: number;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
  icon?: string;
}

/** НЕ `Partial<CreateCategoryInput>`: `null` должен быть выразим, потому что кнопки
 *  «Без цвета» / «Убрать иконку» очищают колонку. `undefined` — «не трогать»,
 *  `null` — «очистить». */
export interface UpdateCategoryInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
}
```

`API_ROUTES.categories.byId` уже существует — константы маршрутов не меняем.

## Эндпоинты

| Метод    | Путь                  | Тело                       | Ответ                           |
| -------- | --------------------- | -------------------------- | ------------------------------- |
| `GET`    | `/api/categories`     | —                          | `200` + `CategoryListItemDto[]` |
| `POST`   | `/api/categories`     | `{ name, color?, icon? }`  | `201` + `CategoryDto`           |
| `PATCH`  | `/api/categories/:id` | `{ name?, color?, icon? }` | `200` + `CategoryDto`           |
| `DELETE` | `/api/categories/:id` | —                          | `204`                           |

`GET` и `POST` уже есть, `PATCH` — новый. Всё под `JwtAuthGuard` («текущие гарды» из задания —
именно он, отдельного гарда владения не заводим), `userId` только из `@CurrentUser()`, никогда
из тела или query. Ограничение выборки владельцем — это и есть защита от чужих строк.

## Файлы

**`packages/database`**

- `prisma/schema.prisma` — `icon String?` в `Category`
- `prisma/migrations/<timestamp>_add_category_icon/migration.sql` — сгенерированный, править не нужно
- `prisma/seed.ts` — иконки в `CATEGORIES`, `icon` в `create`/`update` upsert-а

**`packages/shared`**

- `src/types/category.ts` — по контракту выше

**`apps/backend/src/categories/`**

- `validators/is-single-emoji.ts` — новый:

  ```ts
  @ValidatorConstraint({ name: "isSingleEmoji", async: false })
  class IsSingleEmojiConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
      if (typeof value !== "string" || value.length === 0 || value.length > 32) return false;
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      const graphemes = [...segmenter.segment(value)];
      return (
        graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value)
      );
    }
    defaultMessage(): string {
      return "icon must be a single emoji";
    }
  }
  export function IsSingleEmoji(options?: ValidationOptions) {
    /* registerDecorator */
  }
  ```

  `length > 32` — дешёвая защита до сегментации. `\p{Regional_Indicator}` в альтернативе
  потому, что флаги (🇺🇸) — один графемный кластер, но **не** `Extended_Pictographic`, и без
  этого были бы отвергнуты. Keycap-последовательности (1️⃣) остаются отвергнутыми — это цифра
  плюс комбинирующая рамка, для поля иконки так и надо.

- `dto/create-category.dto.ts` — поле `icon?: string` с `@IsOptional() @IsSingleEmoji()`
  и `@ApiPropertyOptional({ example: "🛒" })`
- `dto/update-category.dto.ts` — новый, ровно по образцу `expenses/dto/update-expense.dto.ts`:
  `export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}`
  (`PartialType` из `@nestjs/swagger`, не из `@nestjs/mapped-types`). Типы `color`/`icon`
  расширить до `string | null`, чтобы очистка колонки была типизирована, а не работала
  случайно из-за `body: unknown` в `apiClient.patch`.
- `categories.service.ts`:
  - `CategoryRecord` (строка 7) получает `icon: string | null`, `toDto` его возвращает
  - `findAll` — `include: { _count: { select: { expenses: true } } }` и отдельный
    маппер `toListItemDto`; `toDto` остаётся плоским
  - новый `update(userId, id, dto): Promise<CategoryDto>` — сначала
    `findFirst({ where: { id, userId } })` и 404, затем проверка уникальности с исключением
    самой строки, затем сборка `data` идиомой `...(dto.x !== undefined && { x: dto.x })`
    из `ExpensesService.update`. Именно этот спред отличает «поле опущено — не трогаем» от
    «пришёл `null` — очищаем»; `@IsOptional()` уже пропускает `null` через валидатор.
  - `remove` без изменений
- `categories.controller.ts` — `@Patch(":id")` с `ParseUUIDPipe` по образцу
  `ExpensesController`; возвращаемый тип `findAll` → `Promise<CategoryListItemDto[]>`
- `categories.service.spec.ts` — новый (сейчас спеки у сервиса нет вообще)

**Рикошет от `CategoryDto`** — `apps/backend/src/expenses/expenses.service.ts` дублирует
`CategoryRecord` (строка 8) и собирает вложенную категорию руками в `toDto` (строки 122-129).
Обоим нужен `icon`. Пропустить нельзя — `tsc` не соберётся.

**Что переиспользуется, а не пишется заново:** паттерн `interface CategoryRecord` + приватный
`toDto()` из `categories.service.ts:7-12,48-55`, идиома частичного обновления из
`expenses.service.ts:77-81`, `JwtAuthGuard` и `@CurrentUser()`, `ParseUUIDPipe` из
`ExpensesController`.

## Порядок работ (бэкенд)

1. `schema.prisma` → `pnpm db:migrate` → `pnpm db:generate`
2. `packages/shared/src/types/category.ts`
3. Валидатор → DTO → сервис → контроллер
4. Починка рикошета в `expenses.service.ts` (до этого момента `tsc` красный)
5. `seed.ts` → `pnpm db:seed`
6. Тесты

## Ловушки

- **`import type` ломает Nest DI.** `UpdateCategoryDto` в `@Body()` и всё, что стоит в
  сигнатуре конструктора, импортируется как значение (CLAUDE.md фиксирует это отдельно).
- **`@MaxLength` на эмодзи считает кодовые единицы UTF-16**, а не графемы — см. решение выше.
- **Проверка уникальности без исключения своей строки** даёт 409 при сохранении без
  переименования.

## Тесты

**`categories.service.spec.ts`** — новый, по образцу `expenses.service.spec.ts`
(фабрика `createPrismaMock()` + `Test.createTestingModule`). `update` — самая рискованная
новая логика:

- переименование в имя, занятое другой категорией → 409
- сохранение с неизменным именем → успех (регрессия на исключение своей строки)
- `update` по id чужого пользователя → 404
- частичное обновление не трогает остальные колонки
- `findAll` отдаёт `expenseCount` из `_count`

**Юнит-тест DTO** — прогон `validate()` над `CreateCategoryDto`: `"🛒"` и `"👨‍👩‍👧‍👦"`
(11 кодовых единиц, 1 графема) и `"🇺🇸"` проходят; `"ab"`, `"🛒🚌"` и обычная буква — нет.

## Верификация

```bash
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm typecheck` — настоящая страховка для правки `CategoryDto`: он красный в `packages/shared`,
`categories.service.ts` и `expenses.service.ts`, пока все три не понесут `icon`.

Бэкенд, против живой БД (Swagger на http://localhost:3001/api/docs):

1. `POST /api/categories` с `{ "name": "Travel", "icon": "✈️", "color": "#0ea5e9" }` → 201, `icon` в ответе
2. То же тело повторно → 409
3. `POST` с `{ "name": "Bad", "icon": "ab" }` → 400 `icon must be a single emoji`;
   повтор с `"👨‍👩‍👧‍👦"` и `"🇺🇸"` → оба 201 (случаи, которые ломают наивное ограничение длины
   и голую проверку `Extended_Pictographic` соответственно)
4. `PATCH /api/categories/:id` с `{ "color": "#ef4444" }` → 200, имя и иконка не изменились
5. `PATCH` с собственным текущим именем категории → 200, а не 409
6. `PATCH` / `DELETE` токеном второго пользователя по id категории первого → 404
7. Любой из четырёх эндпоинтов без заголовка `Authorization` → 401 (проверка гарда)
8. `DELETE` категории с тратами → 204; `GET /api/expenses` показывает эти строки с `categoryId: null`

## Сверх задания: фронтенд

Задание описывает только сущность, сервис и контроллер. Ниже — то, что делается дополнительно,
потому что иначе новым CRUD-ом нельзя пользоваться из приложения: страница `/categories`
(список, поиск по имени, добавление, редактирование, удаление с подтверждением) и фильтр
трат по категории на `/expenses`. Решения, подтверждённые пользователем: «фильтр» — это
**фильтрация таблицы трат по категории** (поиск по имени живёт на странице категорий);
для эмодзи берём **настоящую библиотеку-пикер**; удаление сохраняет текущее поведение
`SetNull`, но получает подтверждение, называющее последствие.

### Решения

**Поиск и фильтрация — на клиенте.** `findAll` и так отдаёт все категории пользователя в кэш
TanStack Query, пагинации у трат нет. Серверный `?search=` потребовал бы query-DTO и возни
с ключами кэша, не давая ничего при таких объёмах. Именно поэтому «поиск» из задания — это
`findAll`, а не параметризованный эндпоинт.

**Мутация категории инвалидирует и `["categories"]`, и `["expenses"]`.** Это главная ловушка
фичи: `ExpenseDto` содержит снимок категории, поэтому без второй инвалидации переименованная
или перекрашенная категория продолжает показываться в таблице трат по-старому. `tsc` этого
не поймает.

**Компоненты формы пишем руками по образцу `login/page.tsx`.** `src/components/ui/` пуст, кроме
`.gitkeep`. Ставить shadcn ради этой фичи — расширение объёма.

### Выбор библиотеки эмодзи

`emoji-picker-react@^4.19.1`. Проверено по реестру npm, а не по памяти:

| Пакет               | Почему не он                                                 |
| ------------------- | ------------------------------------------------------------ |
| `@emoji-mart/react` | peer `react "^16.8 \|\| ^17 \|\| ^18"` — React 19 не заявлен |
| `frimousse`         | тянет данные emojibase с CDN в рантайме                      |

`emoji-picker-react` заявляет `react >=16`, имеет одну транзитивную зависимость (`flairup`)
и везёт датасет внутри пакета — 4.19.1 распаковывается в 34 МБ на 369 файлов, что без
встроенных данных невозможно.

Две проверки install-конфига, обе уже пройдены:

- postinstall-скрипта нет → запись в **`allowBuilds` не нужна**
- 4.19.1 опубликована 2026-04-27, ей три месяца → она вне любого окна `minimumReleaseAge`,
  запись в **`minimumReleaseAgeExclude` тоже не нужна**

Грузим лениво, чтобы датасет не попал в основной бандл:

```ts
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
```

**Рядом с этим НЕЛЬЗЯ писать `import { EmojiStyle }`.** `EmojiStyle` — рантайм-enum, а не тип:
статический импорт затянет весь модуль в основной бандл и молча обнулит `dynamic()`.
Передаём строковый литерал: `emojiStyle="native"`.

### Файлы

- `package.json` — `emoji-picker-react@^4.19.1`
- `src/lib/queries/categories.ts` — новый: `categoriesQueryOptions` и функции мутаций,
  чтобы страница категорий и фильтр трат делили один ключ кэша
- `src/app/categories/page.tsx` — новая страница
- `src/app/expenses/page.tsx` — чипсы фильтра
- `src/app/page.tsx` — ссылка «Categories» (навигации в проекте нет вообще)

Переиспользуется: `apiClient` / `ApiError` (`src/lib/api-client.ts`), паттерн `useForm` +
`zodResolver` + инлайновые Tailwind-классы из `src/app/login/page.tsx`.

### Поведение

**`/categories`** (`"use client"`):

- `useQuery(["categories"])` → `CategoryListItemDto[]`
- **Поиск** — контролируемый input, фильтрация на клиенте по
  `name.toLowerCase().includes(...)`
- **Строка списка** — эмодзи (или нейтральный плейсхолдер), имя, образец цвета,
  `expenseCount`, кнопки редактирования и удаления
- **Форма добавления/редактирования** — один компонент на оба сценария:
  - имя — `z.string().min(1).max(50)`
  - цвет — `<input type="color">` рядом с кнопкой «Без цвета». `type="color"` всегда
    возвращает значение (по умолчанию `#000000`), поэтому без этой кнопки `null` недостижим
  - иконка — кнопка с текущим эмодзи, разворачивающая `EmojiPicker`, плюс «Убрать иконку».
    `onEmojiClick` отдаёт `{ emoji }` — это и есть символ для отправки
- **Удаление** — подтверждение, называющее последствие: «Удалить Groceries? Её 12 трат
  сохранятся, но станут без категории». Используем `<dialog>` или инлайновое состояние,
  а не `window.confirm` — браузерный модал блокирует цикл событий и не тестируется
- **Инвалидация** — после каждой мутации инвалидируем `["categories"]` **и** `["expenses"]`

**`/expenses`** — ряд чипсов: «Все», по чипсу на категорию (эмодзи + имя + счётчик, подкрашен
её цветом) и «Без категории». Фильтрация на клиенте по уже загруженным тратам
(`categoryId === selected`, либо `=== null`). Счётчик записей в шапке и итог `sumAmounts`
пересчитываются по отфильтрованному набору — это и есть полезное поведение.

### Порядок и проверка

Ставится после бэкенда: `pnpm --filter @expense-tracker/frontend add emoji-picker-react` →
`lib/queries/categories.ts` → `/categories` → фильтр на `/expenses` → ссылки.

Проверка вручную (`pnpm dev`, логин `demo@example.com` / `password123`):

1. `/categories` показывает четыре сидовые категории с эмодзи, цветами и счётчиками
2. Ввод «gro» в поиск → только Groceries
3. Добавление категории через пикер эмодзи — появляется без ручного обновления страницы
4. Смена цвета Groceries → на `/expenses` точка **нового** цвета (проверка инвалидации `["expenses"]`)
5. Удаление категории → подтверждение называет число трат; после подтверждения её траты
   на `/expenses` читаются как «Uncategorized»
6. Клик по чипсу категории на `/expenses` → таблица, счётчик записей и итог сужаются до неё;
   «Без категории» показывает отвязанные строки

## Вне объёма

- **Массового `DELETE /api/categories` нет** — «удаление всех категорий пользователя» в задании
  означает, что CRUD ограничен своими категориями, а не удаление одним запросом.
- **Серверные поиск и фильтрация не делаются** — ни `?search=`, ни `?categoryId=`.
  При отсутствии пагинации всё уже в кэше клиента.
- **Поведение удаления не меняется** — `onDelete: SetNull` остаётся, траты сохраняются
  и становятся без категории. Запрет удаления используемых категорий не вводим.
- **shadcn-компоненты не ставятся** — `src/components/ui/` остаётся пустым, формы пишутся
  по образцу `login/page.tsx`.
- **`CategoriesService` не переводится на CQRS** — он, как и `ExpensesService`, инжектит
  `PrismaService` напрямую; CLAUDE.md фиксирует это как осознанное решение, ограниченное
  модулем users.
- **Отдельного гарда владения категорией нет** — владение проверяется в сервисе через
  `where: { id, userId }`, как и во всём остальном проекте.
- **Порядок и группировка категорий, бюджеты на категорию, иконки из набора вместо эмодзи** —
  не входят.
