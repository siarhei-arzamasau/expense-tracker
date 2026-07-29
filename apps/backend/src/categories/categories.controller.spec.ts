import { HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import type { CategoryDto, CategoryListItemDto } from "@expense-tracker/shared";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * The controller is a delegation layer, so this suite is about what it hands to
 * CategoriesService — never about what the service then does, which is
 * categories.service.spec.ts.
 *
 * Three things a direct method call cannot reach: the guard rejecting a
 * request, ParseUUIDPipe rejecting a non-UUID id, and the global ValidationPipe
 * stripping unknown body properties. Nest runs all three in the HTTP pipeline,
 * and only test/app.e2e-spec.ts boots one. The route-metadata cases at the
 * bottom read the decorators instead, because a deleted @UseGuards or @HttpCode
 * is invisible to tsc and to every other spec here.
 */
const USER_ID = "018f0000-0000-7000-8000-000000000001";
const CATEGORY_ID = "018f0000-0000-7000-8000-0000000000aa";

const USER: AuthenticatedUser = { id: USER_ID, email: "demo@example.com" };

function categoryDto(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return {
    id: CATEGORY_ID,
    name: "Groceries",
    color: "#22c55e",
    icon: "🛒",
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function listItem(overrides: Partial<CategoryListItemDto> = {}): CategoryListItemDto {
  return { ...categoryDto(), transactionCount: 12, ...overrides };
}

function createServiceMock() {
  return {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

describe("CategoriesController", () => {
  let controller: CategoriesController;
  let service: ReturnType<typeof createServiceMock>;

  beforeEach(async () => {
    service = createServiceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(CategoriesController);
  });

  describe("findAll", () => {
    it("scopes the list to the id carried by the token", async () => {
      service.findAll.mockResolvedValue([listItem()]);

      await controller.findAll(USER);

      expect(service.findAll).toHaveBeenCalledWith(USER_ID);
    });

    it("returns the service's items without reshaping them", async () => {
      const items = [listItem(), listItem({ name: "Dining", transactionCount: 0 })];
      service.findAll.mockResolvedValue(items);

      // Identity, not equality: the frontend reads this array directly, so a
      // controller that wrapped or copied it would still pass toEqual.
      await expect(controller.findAll(USER)).resolves.toBe(items);
    });
  });

  describe("create", () => {
    it("takes the owner from the token and forwards the validated body", async () => {
      const dto = Object.assign(new CreateCategoryDto(), {
        name: "Groceries",
        color: "#22c55e",
        icon: "🛒",
      });
      service.create.mockResolvedValue(categoryDto());

      await controller.create(USER, dto);

      expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
    });
  });

  describe("update", () => {
    // user.id and id are both plain strings, so transposing them compiles
    // cleanly and would scope the update by category id — asserting the
    // argument order is the only thing standing between that and production.
    it("passes the user id, then the category id, then the body", async () => {
      const dto = Object.assign(new UpdateCategoryDto(), { color: null });
      service.update.mockResolvedValue(categoryDto({ color: null }));

      await controller.update(USER, CATEGORY_ID, dto);

      expect(service.update).toHaveBeenCalledWith(USER_ID, CATEGORY_ID, dto);
    });
  });

  describe("remove", () => {
    it("passes the user id before the category id", async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(USER, CATEGORY_ID);

      expect(service.remove).toHaveBeenCalledWith(USER_ID, CATEGORY_ID);
    });

    it("resolves with nothing, so the 204 body stays empty", async () => {
      service.remove.mockResolvedValue(undefined);

      await expect(controller.remove(USER, CATEGORY_ID)).resolves.toBeUndefined();
    });
  });

  describe("route metadata", () => {
    it("guards all four routes by declaring JwtAuthGuard on the class", () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, CategoriesController) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
    });

    it("answers DELETE with 204 rather than the default 200", () => {
      const status = Reflect.getMetadata(HTTP_CODE_METADATA, CategoriesController.prototype.remove);

      expect(status).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
