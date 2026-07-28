import { PartialType } from "@nestjs/swagger";

import { CreateTransactionDto } from "./create-transaction.dto";

/**
 * Request body for `PATCH /api/transactions/:id`: every field of
 * `CreateTransactionDto`, each one optional.
 *
 * Optional means omitted-is-untouched. A present field still faces the same
 * validators it does on create, so a partial update cannot slip a negative
 * amount or a non-UUID category past the pipe. Deriving from the create DTO
 * rather than restating its fields is what stops the two sides from drifting:
 * a new field has to be added on create, and arrives here for free.
 *
 * One asymmetry worth knowing: `@IsOptional()` treats `null` and `undefined`
 * alike, so `description: null` survives validation and the service reads it as
 * "clear the column" — that column is the only nullable one on the model.
 *
 * PartialType from @nestjs/swagger (not @nestjs/mapped-types) so the generated
 * OpenAPI schema keeps the property metadata as well as the validators.
 */
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
