import { PartialType } from "@nestjs/swagger";

import { CreateCategoryDto } from "./create-category.dto";

/**
 * PartialType keeps both the validators and the generated OpenAPI metadata.
 * null clears color/icon, while undefined leaves the stored value unchanged.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
