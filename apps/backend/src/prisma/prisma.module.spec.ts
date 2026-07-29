import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from "@nestjs/common/constants";

import { PrismaModule } from "./prisma.module";
import { PrismaService } from "./prisma.service";

describe("PrismaModule", () => {
  it("provides one global PrismaService to feature modules", () => {
    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrismaModule)).toBe(true);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PrismaModule)).toEqual([PrismaService]);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, PrismaModule)).toEqual([PrismaService]);
  });
});
