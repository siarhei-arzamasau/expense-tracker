import { PartialType } from "@nestjs/swagger";

import { CreateExpenseDto } from "./create-expense.dto";

/**
 * PartialType from @nestjs/swagger (not @nestjs/mapped-types) so the generated
 * OpenAPI schema keeps the property metadata as well as the validators.
 */
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
