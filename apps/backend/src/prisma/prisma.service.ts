import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPgAdapter, PrismaClient } from "@expense-tracker/database";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Prisma 7 requires a driver adapter — `super()` with no options throws.
  constructor(config: ConfigService) {
    super({ adapter: createPgAdapter(config.getOrThrow<string>("DATABASE_URL")) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
