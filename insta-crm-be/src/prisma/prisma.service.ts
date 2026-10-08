import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { DEFAULT_PIPELINE_STAGES } from "../modules/pipeline/pipeline.constants";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
    await this.ensureDefaultTenant();
  }

  private async ensureDefaultTenant() {
    const existingUser = await this.user.findFirst();
    if (existingUser) return;

    await this.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: "Default Business" },
      });
      await tx.pipelineStage.createMany({
        data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
          businessId: business.id,
          ...stage,
        })),
      });
      await tx.user.create({
        data: {
          businessId: business.id,
          email: "admin@example.com",
          name: "Admin User",
          passwordHash: "NO_PASSWORD",
          phone: "0000000000",
          role: "SUPER_ADMIN",
        },
      });
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
