import { PartialType } from "@nestjs/swagger";

import { CreateTransactionDto } from "./create-transaction.dto";

/**
 * PartialType from @nestjs/swagger (not @nestjs/mapped-types) so the generated
 * OpenAPI schema keeps the property metadata as well as the validators.
 */
export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
