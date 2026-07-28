# New functionality - Create Transaction module

## Context

Project: Nest.js + Next + PostgreSQL + Prisma
What we have: User, Authorization JWT, Category module

## Task

Create TransactionModule - central module of application for managing incomes and spends

## Data model

Add the Transaction model to the Prisma schema:

- id (String, uuid, @default(uuid ()))
- amount (Decimal)
- type (Enum: INCOME, EXPENSE)
- description (String, nullable)
- date (DateTime)
- categoryId (String, relationship with Category)
- userId (String, relationship with User)
- createdAt (DateTime, @default(now()))

Update the User and Category models - add the reverse relationships transactions Transaction []
After changing the schema, create and apply the migration:
npx prisma migrate dev -name add-transactions

## Controller

Endpoints:

- POST /transactions: create a transaction
- GET /transactions: list with query parameters
  " dateFrom, dateTo, type, categoryId (user based)
- GET /transactions/summary: aggregation,
  query parameters month and year (both required)
- GET /transactions/:id: single transaction
- PATCH /transactions/:id: update
- DELETE /transactions/:id: delete

## Pattern

Use apps/backend/src/categories as a template structure for backend

## Restrictions

- Don't add new dependencies if there are not presented in the plan or task
- Use class-validator for DTO
- Build project after implementation
