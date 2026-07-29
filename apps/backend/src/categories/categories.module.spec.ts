import { MODULE_METADATA } from "@nestjs/common/constants";

import { CategoriesController } from "./categories.controller";
import { CategoriesModule } from "./categories.module";
import { CategoriesService } from "./categories.service";

describe("CategoriesModule", () => {
  it("wires and exports category behavior without feature imports", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, CategoriesModule)).toBeUndefined();
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CategoriesModule)).toEqual([
      CategoriesController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CategoriesModule)).toEqual([
      CategoriesService,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, CategoriesModule)).toEqual([
      CategoriesService,
    ]);
  });
});
