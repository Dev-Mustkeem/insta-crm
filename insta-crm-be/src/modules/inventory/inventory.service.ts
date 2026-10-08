import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import type { InventoryItemSummary, StockMovementSummary } from "@insta-crm/shared-types";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";

const itemSelect = {
  id: true,
  sku: true,
  name: true,
  unit: true,
  quantityOnHand: true,
  reorderLevel: true,
  sellingPrice: true,
  active: true,
} satisfies Prisma.InventoryItemSelect;

type ItemRecord = Prisma.InventoryItemGetPayload<{ select: typeof itemSelect }>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, actor: JwtPayload): Promise<InventoryItemSummary[]> {
    await this.requireEnabled(businessId);
    const items = await this.prisma.inventoryItem.findMany({
      where: { businessId, deletedAt: null, ...(actor.role === "STAFF" ? { id: "__staff_denied__" } : {}) },
      select: itemSelect,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return items.map((item) => this.toSummary(item));
  }

  async create(businessId: string, actor: JwtPayload, dto: CreateInventoryItemDto) {
    await this.requireEnabled(businessId);
    if (actor.role === "STAFF") throw new BadRequestException("Staff cannot manage inventory");
    try {
      const item = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.inventoryItem.create({
          data: {
            businessId,
            sku: dto.sku.trim().toUpperCase(),
            name: dto.name.trim(),
            unit: dto.unit?.trim() || "piece",
            quantityOnHand: dto.openingQuantity ?? 0,
            reorderLevel: dto.reorderLevel ?? 0,
            sellingPrice: dto.sellingPrice ?? 0,
          },
          select: itemSelect,
        });
        if ((dto.openingQuantity ?? 0) > 0) {
          await transaction.stockMovement.create({
            data: {
              businessId,
              inventoryItemId: created.id,
              actorId: actor.sub,
              type: StockMovementType.OPENING,
              quantityDelta: dto.openingQuantity ?? 0,
              reason: "Opening stock",
            },
          });
        }
        return created;
      });
      return this.toSummary(item);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An inventory item with this SKU already exists");
      }
      throw error;
    }
  }

  async adjust(businessId: string, actor: JwtPayload, itemId: string, dto: AdjustStockDto) {
    await this.requireEnabled(businessId);
    if (actor.role === "STAFF") throw new BadRequestException("Staff cannot adjust inventory");
    const item = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.inventoryItem.findFirst({ where: { id: itemId, businessId, deletedAt: null }, select: { id: true, quantityOnHand: true } });
      if (!current) throw new NotFoundException("Inventory item not found");
      const nextQuantity = Number(current.quantityOnHand) + dto.quantityDelta;
      if (nextQuantity < 0) throw new BadRequestException("Insufficient stock");
      await transaction.inventoryItem.update({ where: { id: itemId }, data: { quantityOnHand: nextQuantity } });
      await transaction.stockMovement.create({ data: { businessId, inventoryItemId: itemId, actorId: actor.sub, type: StockMovementType.ADJUSTMENT, quantityDelta: dto.quantityDelta, reason: dto.reason || "Manual adjustment" } });
      return transaction.inventoryItem.findFirstOrThrow({ where: { id: itemId, businessId }, select: itemSelect });
    });
    return this.toSummary(item);
  }

  async movements(businessId: string, itemId: string): Promise<StockMovementSummary[]> {
    await this.requireEnabled(businessId);
    const rows = await this.prisma.stockMovement.findMany({
      where: { businessId, inventoryItemId: itemId },
      select: { id: true, inventoryItemId: true, type: true, quantityDelta: true, reason: true, reference: true, createdAt: true, actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({ id: row.id, itemId: row.inventoryItemId, type: row.type, quantityDelta: Number(row.quantityDelta), reason: row.reason, reference: row.reference, actorName: row.actor.name, createdAt: row.createdAt.toISOString() }));
  }

  async consumeForInvoice(transaction: Prisma.TransactionClient, businessId: string, actorId: string, invoiceId: string, lineItems: Array<{ inventoryItemId?: string; quantity: number }>) {
    if (!lineItems.some((line) => line.inventoryItemId)) return;
    const business = await transaction.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { inventoryEnabled: true } });
    if (!business?.inventoryEnabled) throw new BadRequestException("Inventory module is disabled");
    for (const line of lineItems) {
      if (!line.inventoryItemId) continue;
      const item = await transaction.inventoryItem.findFirst({ where: { id: line.inventoryItemId, businessId, deletedAt: null }, select: { id: true, quantityOnHand: true } });
      if (!item) throw new BadRequestException("Inventory item not found");
      if (Number(item.quantityOnHand) < line.quantity) throw new BadRequestException("Insufficient stock for invoice");
      await transaction.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: line.quantity } } });
      await transaction.stockMovement.create({ data: { businessId, inventoryItemId: item.id, actorId, type: StockMovementType.SALE, quantityDelta: -line.quantity, reason: "Invoice stock deduction", reference: invoiceId } });
    }
  }

  private async requireEnabled(businessId: string) {
    const transaction = this.prisma;
    const business = await transaction.business.findFirst({ where: { id: businessId, deletedAt: null }, select: { inventoryEnabled: true } });
    if (!business) throw new NotFoundException("Business not found");
    if (!business.inventoryEnabled) throw new BadRequestException("Inventory module is disabled");
  }

  private toSummary(item: ItemRecord): InventoryItemSummary {
    const quantityOnHand = Number(item.quantityOnHand);
    const reorderLevel = Number(item.reorderLevel);
    return { id: item.id, sku: item.sku, name: item.name, unit: item.unit, quantityOnHand, reorderLevel, sellingPrice: Number(item.sellingPrice), active: item.active, lowStock: quantityOnHand <= reorderLevel };
  }
}
