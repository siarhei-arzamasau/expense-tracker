import { PartialType } from "@nestjs/swagger";

import { CreateCategoryDto } from "./create-category.dto";

/**
 * Request body for `PATCH /api/categories/:id`: every field of
 * `CreateCategoryDto`, each one optional.
 *
 * Omitted fields keep their stored values. A present field still faces the
 * create validator, while `null` clears `color` or `icon`. Deriving the class
 * prevents create and update validation or OpenAPI metadata from drifting.
 *
 * `PartialType` comes from `@nestjs/swagger`, not `@nestjs/mapped-types`, so it
 * retains both the validators and the generated OpenAPI property metadata.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
