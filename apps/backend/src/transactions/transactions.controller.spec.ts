import { HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import type {
  PaginatedResponse,
  TransactionDto,
  TransactionSummaryDto,
} from "@expense-tracker/shared";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../auth/types";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { FindTransactionsQueryDto } from "./dto/find-transactions-query.dto";
import { TransactionSummaryQueryDto } from "./dto/transaction-summary-query.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { TransactionsController } from "./transactions.controller";
import { TransactionsService } from "./transactions.service";

/**
 * The controller is a delegation layer, so this suite is about what reaches
 * TransactionsService — never about what the service then does, which is
 * transactions.service.spec.ts.
 *
 * A direct method call skips the HTTP pipeline, so nothing here proves the
 * guard returns 401, that ParseUUIDPipe rejects a non-UUID, or that the global
 * ValidationPipe coerces query strings to numbers and rejects unknown
 * parameters. Those need test/app.e2e-spec.ts and a live database. The
 * declaration-order and metadata cases at the bottom read the decorators
 * directly, because what they pin down is invisible to tsc, to Oxlint, and to
 * every other spec in this repository.
 */
const USER_ID = "018f0000-0000-7000-8000-000000000001";
const TRANSACTION_ID = "018f0000-0000-7000-8000-0000000000aa";
const CATEGORY_ID = "018f0000-0000-7000-8000-0000000000cc";

const USER: AuthenticatedUser = { id: USER_ID, email: "demo@example.com" };

function transactionDto(overrides: Partial<TransactionDto> = {}): TransactionDto {
  return {
    id: TRANSACTION_ID,
    amount: "42.50",
    type: "EXPENSE",
    description: "Weekly shop",
    date: "2026-07-01T12:00:00.000Z",
    categoryId: CATEGORY_ID,
    category: {
      id: CATEGORY_ID,
      name: "Groceries",
      color: "#22c55e",
      icon: "🛒",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    createdAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

function page(
  overrides: Partial<PaginatedResponse<TransactionDto>> = {},
): PaginatedResponse<TransactionDto> {
  return {
    items: [transactionDto()],
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    ...overrides,
  };
}

function summaryDto(overrides: Partial<TransactionSummaryDto> = {}): TransactionSummaryDto {
  return {
    month: 7,
    year: 2026,
    income: "1000.10",
    expense: "250.05",
    balance: "750.05",
    ...overrides,
  };
}

function createServiceMock() {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    summary: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

describe("TransactionsController", () => {
  let controller: TransactionsController;
  let service: ReturnType<typeof createServiceMock>;

  beforeEach(async () => {
    service = createServiceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(TransactionsController);
  });

  describe("create", () => {
    it("takes the owner from the token and forwards the validated body", async () => {
      const dto = Object.assign(new CreateTransactionDto(), {
        amount: 42.5,
        type: "EXPENSE",
        date: "2026-07-01T12:00:00.000Z",
        categoryId: CATEGORY_ID,
      });
      service.create.mockResolvedValue(transactionDto());

      await controller.create(USER, dto);

      expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
    });
  });

  describe("findAll", () => {
    it("passes the filters through as one object rather than unpacking them", async () => {
      const query = Object.assign(new FindTransactionsQueryDto(), {
        page: 3,
        search: "Lunch",
        type: "INCOME",
        categoryId: CATEGORY_ID,
      });
      service.findAll.mockResolvedValue(page({ page: 3 }));

      await controller.findAll(USER, query);

      expect(service.findAll).toHaveBeenCalledWith(USER_ID, query);
    });

    it("returns the service's page without reshaping it", async () => {
      const result = page({ items: [], totalItems: 0, totalPages: 0 });
      service.findAll.mockResolvedValue(result);

      // Identity, not equality: the envelope goes to the frontend as-is, so a
      // controller that rebuilt or wrapped it would still satisfy toEqual.
      await expect(controller.findAll(USER, new FindTransactionsQueryDto())).resolves.toBe(result);
    });
  });

  describe("summary", () => {
    // month and year are both plain numbers, so transposing them compiles
    // cleanly and would summarise month 2026 of year 7. The distinct values
    // here are what makes the assertion able to catch that.
    it("unpacks the query into user id, then month, then year", async () => {
      const query = Object.assign(new TransactionSummaryQueryDto(), { month: 7, year: 2026 });
      service.summary.mockResolvedValue(summaryDto());

      await controller.summary(USER, query);

      expect(service.summary).toHaveBeenCalledWith(USER_ID, 7, 2026);
    });
  });

  describe("findOne", () => {
    it("passes the user id before the transaction id", async () => {
      service.findOne.mockResolvedValue(transactionDto());

      await controller.findOne(USER, TRANSACTION_ID);

      expect(service.findOne).toHaveBeenCalledWith(USER_ID, TRANSACTION_ID);
    });
  });

  describe("update", () => {
    // Same transposition risk as findOne, with a third argument behind it: both
    // ids are strings, so a swap scopes the update by transaction id.
    it("passes the user id, then the transaction id, then the body", async () => {
      const dto = Object.assign(new UpdateTransactionDto(), { description: null });
      service.update.mockResolvedValue(transactionDto({ description: null }));

      await controller.update(USER, TRANSACTION_ID, dto);

      expect(service.update).toHaveBeenCalledWith(USER_ID, TRANSACTION_ID, dto);
    });
  });

  describe("remove", () => {
    it("passes the user id before the transaction id", async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(USER, TRANSACTION_ID);

      expect(service.remove).toHaveBeenCalledWith(USER_ID, TRANSACTION_ID);
    });

    it("resolves with nothing, so the 204 body stays empty", async () => {
      service.remove.mockResolvedValue(undefined);

      await expect(controller.remove(USER, TRANSACTION_ID)).resolves.toBeUndefined();
    });
  });

  describe("route declaration order", () => {
    // Nest matches routes in declaration order. Declared after findOne, the
    // literal path "summary" is captured by ":id" instead, handed to
    // ParseUUIDPipe, and answered with 400 — GET /api/transactions/summary
    // stops working. Both handlers typecheck, lint and unit-test identically
    // in either order, so this is the only thing that would notice a member
    // sort or a careless merge.
    it("declares the literal summary route ahead of the :id route", () => {
      const handlers = Object.getOwnPropertyNames(TransactionsController.prototype);

      expect(Reflect.getMetadata(PATH_METADATA, TransactionsController.prototype.summary)).toBe(
        "summary",
      );
      expect(Reflect.getMetadata(PATH_METADATA, TransactionsController.prototype.findOne)).toBe(
        ":id",
      );
      expect(handlers.indexOf("summary")).toBeLessThan(handlers.indexOf("findOne"));
    });
  });

  describe("route metadata", () => {
    it("guards all six routes by declaring JwtAuthGuard on the class", () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, TransactionsController) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
    });

    it("answers DELETE with 204 rather than the default 200", () => {
      const status = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        TransactionsController.prototype.remove,
      );

      expect(status).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
