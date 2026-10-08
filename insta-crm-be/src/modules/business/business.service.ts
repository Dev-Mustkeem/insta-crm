import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { CompleteSetupDto } from "./dto/complete-setup.dto";

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async completeSetup(businessId: string, dto: CompleteSetupDto) {
    const result = await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: {
        businessType: dto.businessType,
        teamSize: dto.teamSize,
        onboardingCompletedAt: new Date(),
      },
    });
    if (result.count === 0) throw new NotFoundException("Business not found");

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        businessType: true,
        teamSize: true,
        onboardingCompletedAt: true,
        inventoryEnabled: true,
      },
    });
    return {
      ...business,
      onboardingCompletedAt:
        business.onboardingCompletedAt?.toISOString() ?? null,
      inventoryEnabled: business.inventoryEnabled,
    };
  }

  async setInventoryEnabled(businessId: string, enabled: boolean) {
    const result = await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: { inventoryEnabled: Boolean(enabled) },
    });
    if (!result.count) throw new NotFoundException("Business not found");
    return { inventoryEnabled: Boolean(enabled) };
  }
}
