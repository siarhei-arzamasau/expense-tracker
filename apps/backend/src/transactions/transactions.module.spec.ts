import { MODULE_METADATA } from "@nestjs/common/constants";

import { TransactionsController } from "./transactions.controller";
import { TransactionsModule } from "./transactions.module";
import { TransactionsService } from "./transactions.service";

describe("TransactionsModule", () => {
  it("wires and exports transaction behavior without feature imports", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, TransactionsModule)).toBeUndefined();
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, TransactionsModule)).toEqual([
      TransactionsController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TransactionsModule)).toEqual([
      TransactionsService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, TransactionsModule)).toEqual([
      TransactionsService,
    ]);
  });
});
