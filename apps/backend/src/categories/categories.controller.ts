import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { CategoryDto, CategoryListItemDto } from "@expense-tracker/shared";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { errorSchema } from "../common/swagger/error-schema";
import { CategoriesService } from "./categories.service";
import { CATEGORY_LIST_ITEM_SCHEMA, CATEGORY_SCHEMA } from "./category.schema";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * Documents the category id path parameter shared by update and delete.
 *
 * Swagger detects the path parameter itself, but this adds the UUID format and
 * documents the 400 produced by `ParseUUIDPipe`.
 */
const ID_PARAM = {
  name: "id",
  format: "uuid",
  description: "Category id. Anything that is not a UUID is rejected with 400.",
} as const;

/**
 * HTTP surface for `/api/categories`.
 *
 * Authentication covers the class, so every route answers 401 before its
 * handler runs when the bearer token is missing or invalid. Ownership always
 * comes from `@CurrentUser()`; no request can select a different owner.
 *
 * The 401 response is declared at class level alongside the guard and bearer
 * scheme because it applies equally to all four operations.
 */
@ApiTags("categories")
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: "Missing, malformed or expired bearer token",
  schema: errorSchema(HttpStatus.UNAUTHORIZED, "Unauthorized"),
})
@UseGuards(JwtAuthGuard)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * `GET /api/categories` — lists the current user's categories.
   *
   * @param user - Authenticated user, from the JWT.
   * @returns 200 with categories ordered by name and their transaction counts.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   */
  @Get()
  @ApiOperation({
    summary: "List the current user's categories",
    description:
      "Returns every category owned by the caller in ascending name order. Each item includes the number of transactions assigned to it; an account with no categories receives an empty array.",
  })
  @ApiOkResponse({
    description: "The user's categories with transaction counts",
    schema: { type: "array", items: CATEGORY_LIST_ITEM_SCHEMA },
  })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<CategoryListItemDto[]> {
    return this.categoriesService.findAll(user.id);
  }

  /**
   * `POST /api/categories` — creates a category for the current user.
   *
   * @param user - Authenticated user, from the JWT.
   * @param dto - Request body, validated by the global `ValidationPipe`.
   * @returns 201 with the created category.
   * @throws {BadRequestException} 400 — the body fails validation or contains
   * an unknown property.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {ConflictException} 409 — the user already has that category name.
   */
  @Post()
  @ApiOperation({
    summary: "Create a category",
    description:
      "The owner is taken from the bearer token. Names are unique within that user's categories; colour and icon are optional nullable presentation metadata.",
  })
  @ApiCreatedResponse({ description: "The created category", schema: CATEGORY_SCHEMA })
  @ApiBadRequestResponse({
    description: "The body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, [
      "name must be shorter than or equal to 50 characters",
    ]),
  })
  @ApiConflictResponse({
    description: "This user already has a category with the submitted name",
    schema: errorSchema(HttpStatus.CONFLICT, 'A category named "Groceries" already exists'),
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoriesService.create(user.id, dto);
  }

  /**
   * `PATCH /api/categories/:id` — updates fields present in the request body.
   *
   * @param user - Authenticated user, from the JWT.
   * @param id - Category id; `ParseUUIDPipe` rejects non-UUID values.
   * @param dto - Any subset of the create payload; omitted fields are unchanged.
   * @returns 200 with the updated category.
   * @throws {BadRequestException} 400 — `id` or the body fails validation.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — no such category belongs to this user.
   * @throws {ConflictException} 409 — another category has the submitted name.
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Update a category",
    description:
      "Scoped to the caller. Omitted fields keep their stored values; sending `null` for colour or icon clears that nullable field. Saving an unchanged name is allowed.",
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: "The updated category", schema: CATEGORY_SCHEMA })
  @ApiBadRequestResponse({
    description: "`id` is not a UUID, or the body failed validation or carried an unknown property",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Validation failed (uuid is expected)"),
  })
  @ApiNotFoundResponse({
    description: "No category with that id belongs to this user",
    schema: errorSchema(HttpStatus.NOT_FOUND, "Category not found"),
  })
  @ApiConflictResponse({
    description: "Another category owned by this user has the submitted name",
    schema: errorSchema(HttpStatus.CONFLICT, 'A category named "Groceries" already exists'),
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoriesService.update(user.id, id, dto);
  }

  /**
   * `DELETE /api/categories/:id` — permanently deletes an unused category.
   *
   * @param user - Authenticated user, from the JWT.
   * @param id - Category id; `ParseUUIDPipe` rejects non-UUID values.
   * @returns 204 No Content with an empty body.
   * @throws {BadRequestException} 400 — `id` is not a UUID.
   * @throws {UnauthorizedException} 401 — no valid bearer token.
   * @throws {NotFoundException} 404 — no such category belongs to this user.
   * @throws {ConflictException} 409 — transactions still reference the category.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete an unused category",
    description:
      "Permanent. A category that still has transactions is retained and answers 409. Deleting the same id twice answers 404 the second time.",
  })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({ description: "The category was deleted; the body is empty" })
  @ApiBadRequestResponse({
    description: "`id` is not a UUID",
    schema: errorSchema(HttpStatus.BAD_REQUEST, "Validation failed (uuid is expected)"),
  })
  @ApiNotFoundResponse({
    description: "No category with that id belongs to this user",
    schema: errorSchema(HttpStatus.NOT_FOUND, "Category not found"),
  })
  @ApiConflictResponse({
    description: "Transactions still reference the category",
    schema: errorSchema(HttpStatus.CONFLICT, "Category still has transactions"),
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.categoriesService.remove(user.id, id);
  }
}
