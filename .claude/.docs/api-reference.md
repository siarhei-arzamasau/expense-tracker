# API Reference

This document describes the current REST API contract implemented by the NestJS backend. Swagger
UI exposes the generated OpenAPI document at
[http://localhost:3001/api/docs](http://localhost:3001/api/docs) while the development server is
running.

## Conventions

### Base URL

The default local base URL is:

```text
http://localhost:3001/api
```

All paths below include the global `/api` prefix. The backend port is controlled by `API_PORT`.

### Content type

Requests with a body use JSON:

```http
Content-Type: application/json
```

Successful create and read operations return JSON. Successful password changes, password resets,
and deletes return `204 No Content` with no response body.

### Authentication

Registration, login, forgot-password, and reset-password endpoints are public. Every other endpoint
requires the access token returned by registration or login:

```http
Authorization: Bearer <accessToken>
```

Missing, malformed, or expired tokens return `401`. A token whose user has been deleted also
returns `401` from `GET /api/auth/me`.

### Validation

The global validation pipe:

- Converts supported query parameters into their DTO types.
- Removes no unknown data silently: unknown body or query properties are rejected with `400`.
- Validates request bodies, path UUIDs, and query parameters before controller logic runs.
- May return multiple validation messages for one request.

### Error shape

Nest's built-in exception handling returns:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

`message` is either a string or an array of strings. `error` may be omitted when it would duplicate
the message.

### Ownership behavior

All category and transaction operations are scoped to the authenticated user. Requests never
accept a `userId`. Supplying another user's object id behaves like a missing object and returns
`404`, preventing id-existence probing.

## Common response models

### User

```json
{
  "id": "01985d8d-bb2b-7d8e-b407-9cd0d2c65ec3",
  "email": "demo@example.com",
  "name": "Demo User",
  "createdAt": "2026-07-28T12:00:00.000Z"
}
```

`name` may be `null`. Password hashes are never returned.

### Authentication response

```json
{
  "accessToken": "<signed-jwt>",
  "user": {
    "id": "01985d8d-bb2b-7d8e-b407-9cd0d2c65ec3",
    "email": "demo@example.com",
    "name": "Demo User",
    "createdAt": "2026-07-28T12:00:00.000Z"
  }
}
```

### Category

```json
{
  "id": "01985d8e-1dce-72c1-8b28-2307a38f552a",
  "name": "Groceries",
  "color": "#22c55e",
  "icon": "🛒",
  "createdAt": "2026-07-28T12:01:00.000Z"
}
```

`color` and `icon` may be `null`. Category-list responses add `transactionCount`.

### Transaction

```json
{
  "id": "01985d8f-d266-7b05-a874-254260344725",
  "amount": "82.40",
  "type": "EXPENSE",
  "description": "Weekly shop",
  "date": "2026-07-28T12:00:00.000Z",
  "categoryId": "01985d8e-1dce-72c1-8b28-2307a38f552a",
  "category": {
    "id": "01985d8e-1dce-72c1-8b28-2307a38f552a",
    "name": "Groceries",
    "color": "#22c55e",
    "icon": "🛒",
    "createdAt": "2026-07-28T12:01:00.000Z"
  },
  "createdAt": "2026-07-28T12:02:00.000Z"
}
```

`amount` is always a two-decimal string. `description` may be `null`.

### Paginated transactions

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "totalItems": 0,
  "totalPages": 0
}
```

`totalPages` is `0` when no transactions match. A page past the last page returns an empty `items`
array rather than an error.

## Authentication endpoints

### Register

```http
POST /api/auth/register
```

Public. Creates an account and immediately returns an access token.

| Field      | Type   | Required | Validation                                            |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `email`    | string | Yes      | Valid email and globally unique.                      |
| `password` | string | Yes      | 8-72 characters.                                      |
| `name`     | string | No       | Maximum 100 characters. Omission is stored as `null`. |

Example request:

```json
{
  "email": "developer@example.com",
  "password": "password123",
  "name": "Developer"
}
```

| Status | Meaning                                              |
| ------ | ---------------------------------------------------- |
| `201`  | Account created; returns an authentication response. |
| `400`  | Invalid or unknown request property.                 |
| `409`  | An account already uses the email.                   |

### Login

```http
POST /api/auth/login
```

Public. Verifies credentials and returns an authentication response.

| Field      | Type   | Required | Validation          |
| ---------- | ------ | -------- | ------------------- |
| `email`    | string | Yes      | Valid email syntax. |
| `password` | string | Yes      | Non-empty string.   |

Unknown emails and wrong passwords deliberately return the same response.

| Status | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| `200`  | Credentials accepted; returns an authentication response. |
| `400`  | Invalid or unknown request property.                      |
| `401`  | `Invalid email or password`.                              |

### Get current user

```http
GET /api/auth/me
```

Bearer authentication required. Returns the current public user record.

| Status | Meaning                                                            |
| ------ | ------------------------------------------------------------------ |
| `200`  | Returns `UserDto`.                                                 |
| `401`  | Token is missing, malformed, expired, or refers to a deleted user. |

### Request a password reset

```http
POST /api/auth/forgot-password
```

Public.

```json
{
  "email": "demo@example.com"
}
```

`email` must have valid email syntax. A valid request always returns `204`, whether or not the
account exists. For a known account, the development backend logs a reset URL rather than sending
email. Issuing a new link deletes all older reset tokens for that user.

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| `204`  | Request accepted; empty body.              |
| `400`  | Invalid email or unknown request property. |

### Reset a password

```http
POST /api/auth/reset-password
```

Public.

| Field      | Type   | Required | Validation                                                         |
| ---------- | ------ | -------- | ------------------------------------------------------------------ |
| `token`    | string | Yes      | Exactly 43 characters; base64url form of the issued 32-byte token. |
| `password` | string | Yes      | 8-72 characters.                                                   |

```json
{
  "token": "<token-from-reset-url>",
  "password": "new-password-456"
}
```

The token is single-use and expires after 60 minutes. A successful reset consumes all outstanding
reset tokens for the account.

| Status | Meaning                                                              |
| ------ | -------------------------------------------------------------------- |
| `204`  | Password replaced; empty body.                                       |
| `400`  | Invalid body or reset link is unknown, expired, or already consumed. |

## User endpoints

All user endpoints require bearer authentication and always act on the current account.

### Update profile

```http
PATCH /api/users/me
```

At least one field must be present.

| Field   | Type             | Required | Behavior                                                     |
| ------- | ---------------- | -------- | ------------------------------------------------------------ |
| `email` | string           | No       | Must be a valid email. Omission keeps the current value.     |
| `name`  | string or `null` | No       | Maximum 100 characters. `null` clears it; omission keeps it. |

```json
{
  "name": "Updated Name"
}
```

| Status | Meaning                                                         |
| ------ | --------------------------------------------------------------- |
| `200`  | Returns the updated user.                                       |
| `400`  | Invalid body, unknown property, or no supported field supplied. |
| `401`  | Missing or invalid token.                                       |
| `404`  | The token's user no longer exists.                              |
| `409`  | Another account already uses the requested email.               |

### Change password

```http
PATCH /api/users/me/password
```

| Field             | Type   | Required | Validation                                |
| ----------------- | ------ | -------- | ----------------------------------------- |
| `currentPassword` | string | Yes      | Non-empty and must match the stored hash. |
| `newPassword`     | string | Yes      | 8-72 characters.                          |

```json
{
  "currentPassword": "password123",
  "newPassword": "new-password-456"
}
```

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `204`  | Password changed; empty body.                           |
| `400`  | Invalid or unknown request property.                    |
| `401`  | Missing/invalid token or current password is incorrect. |
| `404`  | The token's user no longer exists.                      |

Existing access tokens are not revoked.

### Delete account

```http
DELETE /api/users/me
```

The request body must contain the current password:

```json
{
  "password": "password123"
}
```

Deletion is permanent. PostgreSQL cascades the deletion to categories, transactions, and reset
tokens.

| Status | Meaning                                         |
| ------ | ----------------------------------------------- |
| `204`  | Account and owned data deleted; empty body.     |
| `400`  | Invalid or unknown request property.            |
| `401`  | Missing/invalid token or password is incorrect. |
| `404`  | User no longer exists.                          |

## Category endpoints

All category endpoints require bearer authentication.

### List categories

```http
GET /api/categories
```

Returns the current user's categories sorted by name ascending. Each item adds the number of
referencing transactions:

```json
[
  {
    "id": "01985d8e-1dce-72c1-8b28-2307a38f552a",
    "name": "Groceries",
    "color": "#22c55e",
    "icon": "🛒",
    "createdAt": "2026-07-28T12:01:00.000Z",
    "transactionCount": 3
  }
]
```

An account with no categories receives `[]`.

| Status | Meaning                   |
| ------ | ------------------------- |
| `200`  | Category list returned.   |
| `401`  | Missing or invalid token. |

### Create category

```http
POST /api/categories
```

| Field   | Type             | Required | Validation                                        |
| ------- | ---------------- | -------- | ------------------------------------------------- |
| `name`  | string           | Yes      | 1-50 characters; unique per user.                 |
| `color` | string or `null` | No       | CSS hexadecimal color; `null` means no color.     |
| `icon`  | string or `null` | No       | Exactly one emoji grapheme; `null` means no icon. |

```json
{
  "name": "Groceries",
  "color": "#22c55e",
  "icon": "🛒"
}
```

| Status | Meaning                                         |
| ------ | ----------------------------------------------- |
| `201`  | Returns the created category.                   |
| `400`  | Invalid or unknown request property.            |
| `401`  | Missing or invalid token.                       |
| `409`  | The user already has a category with that name. |

### Update category

```http
PATCH /api/categories/:id
```

`id` must be a UUID. Any subset of the create fields may be supplied. Omitted fields are unchanged;
`null` clears `color` or `icon`. Saving the current name is valid.

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `200`  | Returns the updated category.                           |
| `400`  | Invalid UUID, body, or unknown property.                |
| `401`  | Missing or invalid token.                               |
| `404`  | No matching category belongs to the user.               |
| `409`  | Another owned category already uses the requested name. |

### Delete category

```http
DELETE /api/categories/:id
```

Only unused categories can be deleted. The transaction relation is required and uses database
`RESTRICT` behavior, so deleting a referenced category returns `409` rather than orphaning or
deleting transactions.

| Status | Meaning                                   |
| ------ | ----------------------------------------- |
| `204`  | Category deleted; empty body.             |
| `400`  | `id` is not a UUID.                       |
| `401`  | Missing or invalid token.                 |
| `404`  | No matching category belongs to the user. |
| `409`  | `Category still has transactions`.        |

Deleting the same id twice returns `404` on the second request.

## Transaction endpoints

All transaction endpoints require bearer authentication.

### List transactions

```http
GET /api/transactions
```

Results are ordered by `date` descending and then `id` descending. Filters are combined with AND
and applied in PostgreSQL.

| Query parameter | Type            | Required | Validation and behavior                                                        |
| --------------- | --------------- | -------- | ------------------------------------------------------------------------------ |
| `page`          | integer         | No       | 1-10,000; defaults to 1. Page size is fixed at 10.                             |
| `search`        | string          | No       | Maximum 255 characters; case-insensitive substring match on description only.  |
| `type`          | enum            | No       | `INCOME` or `EXPENSE`.                                                         |
| `categoryId`    | UUID            | No       | Filters by category. A foreign category id simply matches nothing.             |
| `dateFrom`      | ISO-8601 string | No       | Inclusive lower bound.                                                         |
| `dateTo`        | ISO-8601 string | No       | Inclusive upper bound. Include end-of-day time when the whole day is intended. |

Example:

```http
GET /api/transactions?page=1&type=EXPENSE&search=shop&dateFrom=2026-07-01T00:00:00.000Z
```

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| `200`  | Returns `PaginatedResponse<TransactionDto>`. |
| `400`  | Unknown query parameter or invalid value.    |
| `401`  | Missing or invalid token.                    |

### Monthly summary

```http
GET /api/transactions/summary?month=7&year=2026
```

| Query parameter | Type    | Required | Validation |
| --------------- | ------- | -------- | ---------- |
| `month`         | integer | Yes      | 1-12.      |
| `year`          | integer | Yes      | 1970-2100. |

The month is calculated in UTC. A month without transactions returns zero values rather than
`404`:

```json
{
  "month": 7,
  "year": 2026,
  "income": "3200.00",
  "expense": "1847.60",
  "balance": "1352.40"
}
```

`balance` is `income - expense` and may be negative. Every money value is a two-decimal string.

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `200`  | Summary returned.                                          |
| `400`  | A parameter is missing, non-numeric, or outside its range. |
| `401`  | Missing or invalid token.                                  |

### Get transaction

```http
GET /api/transactions/:id
```

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| `200`  | Returns the transaction with its category.   |
| `400`  | `id` is not a UUID.                          |
| `401`  | Missing or invalid token.                    |
| `404`  | No matching transaction belongs to the user. |

### Create transaction

```http
POST /api/transactions
```

| Field         | Type            | Required | Validation                                                   |
| ------------- | --------------- | -------- | ------------------------------------------------------------ |
| `amount`      | number          | Yes      | Positive, at most 2 decimal places, maximum `9,999,999,999`. |
| `type`        | enum            | Yes      | `INCOME` or `EXPENSE`; the amount itself is never negative.  |
| `description` | string          | No       | Maximum 255 characters; omission stores `null`.              |
| `date`        | ISO-8601 string | Yes      | Transaction date; future values are accepted.                |
| `categoryId`  | UUID            | Yes      | Must belong to the authenticated user.                       |

```json
{
  "amount": 82.4,
  "type": "EXPENSE",
  "description": "Weekly shop",
  "date": "2026-07-28T12:00:00.000Z",
  "categoryId": "01985d8e-1dce-72c1-8b28-2307a38f552a"
}
```

The response converts `82.4` to the exact string `"82.40"`.

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| `201`  | Returns the created transaction.                               |
| `400`  | Invalid/unknown property or category is not owned by the user. |
| `401`  | Missing or invalid token.                                      |

### Update transaction

```http
PATCH /api/transactions/:id
```

Any subset of the create fields may be supplied. Omitted fields are unchanged. At runtime,
`description: null` clears the nullable description column.

| Status | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| `200`  | Returns the updated transaction.                          |
| `400`  | Invalid UUID/body, unknown property, or unowned category. |
| `401`  | Missing or invalid token.                                 |
| `404`  | No matching transaction belongs to the user.              |

### Delete transaction

```http
DELETE /api/transactions/:id
```

| Status | Meaning                                      |
| ------ | -------------------------------------------- |
| `204`  | Transaction deleted; empty body.             |
| `400`  | `id` is not a UUID.                          |
| `401`  | Missing or invalid token.                    |
| `404`  | No matching transaction belongs to the user. |

Deleting the same id twice returns `404` on the second request.

## Testing with curl

Register or log in and copy the returned token:

```bash
curl -sS http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
```

Use the token for a protected request:

```bash
curl -sS http://localhost:3001/api/transactions?page=1 \
  -H 'Authorization: Bearer <accessToken>'
```
