import { Injectable } from "@nestjs/common";
import { InvoiceStatus, RelatedEntityType, TaskSource } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InvoiceAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async syncOverdue(businessId: string, now = new Date()) {
    const today = this.indiaDate(now);
    const candidates = await this.prisma.invoice.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdById: true,
        issuedAt: true,
        dueDate: true,
        creditTermsDays: true,
        creditTermsBreachedAt: true,
        contact: { select: { name: true } },
      },
    });
    const invoices = candidates.filter((invoice) => {
      const agreedDue = invoice.issuedAt
        ? new Date(
            invoice.issuedAt.getTime() + invoice.creditTermsDays * 86_400_000,
          )
        : invoice.dueDate;
      return agreedDue < today;
    });
    if (!invoices.length) {
      return { invoicesMarkedOverdue: 0, reminderTasksCreated: 0 };
    }

    const marked = await this.prisma.invoice.updateMany({
      where: {
        businessId,
        id: { in: invoices.map((invoice) => invoice.id) },
        status: InvoiceStatus.SENT,
        deletedAt: null,
      },
      data: {
        status: InvoiceStatus.OVERDUE,
        creditTermsBreachedAt: now,
      },
    });
    const existing = await this.prisma.task.findMany({
      where: {
        businessId,
        deletedAt: null,
        source: TaskSource.PAYMENT_REMINDER,
        relatedEntityType: RelatedEntityType.INVOICE,
        relatedEntityId: { in: invoices.map((invoice) => invoice.id) },
      },
      select: { relatedEntityId: true },
    });
    const existingIds = new Set(existing.map((task) => task.relatedEntityId));
    const missing = invoices.filter((invoice) => !existingIds.has(invoice.id));
    const created = missing.length
      ? await this.prisma.task.createMany({
          data: missing.map((invoice) => ({
            businessId,
            title:
              "Payment reminder: " +
              (invoice.invoiceNumber ?? "Draft invoice") +
              " - " +
              invoice.contact.name,
            dueAt: now,
            assignedToId: invoice.createdById,
            relatedEntityType: RelatedEntityType.INVOICE,
            relatedEntityId: invoice.id,
            source: TaskSource.PAYMENT_REMINDER,
          })),
        })
      : { count: 0 };
    return {
      invoicesMarkedOverdue: marked.count,
      reminderTasksCreated: created.count,
    };
  }

  private indiaDate(now: Date) {
    const india = new Date(now.getTime() + 330 * 60 * 1000);
    return new Date(
      Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()),
    );
  }
}
