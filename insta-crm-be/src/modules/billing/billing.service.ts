import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InvoiceStatus as PrismaInvoiceStatus,
  PaymentMethod as PrismaPaymentMethod,
  Prisma,
  TaskStatus,
} from "@prisma/client";
import type {
  BillingOptionsResponse,
  BillingSettings,
  InvoiceDetail,
  InvoiceLineItem,
  InvoicePrefillResponse,
  InvoiceStatus,
  InvoiceSummary,
  PaymentMethod,
  PaymentSummary,
  ReceivablesAgingSummary,
  CustomerReceivableSummary,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatePaymentDto } from "./dto/create-payment.dto";
import type { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import type { SaveInvoiceDto } from "./dto/save-invoice.dto";
import type { UpdateBillingSettingsDto } from "./dto/update-billing-settings.dto";
import type { Gstr1QueryDto } from "./dto/gstr1-query.dto";
import {
  GST_COMPLIANCE_PROVIDER,
  type GSTComplianceProvider,
} from "./gst-compliance.provider";
import { InvoiceAutomationService } from "./invoice-automation.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { InventoryService } from "../inventory/inventory.service";

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  lineItems: true,
  subtotal: true,
  taxTotal: true,
  grandTotal: true,
  status: true,
  dueDate: true,
  creditTermsDays: true,
  creditTermsBreachedAt: true,
  issuedAt: true,
  irn: true,
  qrCodeUrl: true,
  createdAt: true,
  updatedAt: true,
  contact: {
    select: { id: true, name: true, phone: true, email: true },
  },
  deal: { select: { id: true, title: true } },
  business: {
    select: {
      id: true,
      name: true,
      eInvoiceApplicable: true,
      gstin: true,
      stateCode: true,
      users: {
        where: { role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, phone: true },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
  payments: {
    where: { deletedAt: null },
    select: {
      id: true,
      amount: true,
      method: true,
      paidAt: true,
      createdAt: true,
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.InvoiceSelect;

type InvoiceRecord = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;
type PaymentRecord = InvoiceRecord["payments"][number];

const statusToPrisma: Record<InvoiceStatus, PrismaInvoiceStatus> = {
  draft: PrismaInvoiceStatus.DRAFT,
  sent: PrismaInvoiceStatus.SENT,
  paid: PrismaInvoiceStatus.PAID,
  overdue: PrismaInvoiceStatus.OVERDUE,
};

const statusFromPrisma: Record<PrismaInvoiceStatus, InvoiceStatus> = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
};

const methodToPrisma: Record<PaymentMethod, PrismaPaymentMethod> = {
  cash: PrismaPaymentMethod.CASH,
  upi: PrismaPaymentMethod.UPI,
  "bank-transfer": PrismaPaymentMethod.BANK_TRANSFER,
  card: PrismaPaymentMethod.CARD,
  cheque: PrismaPaymentMethod.CHEQUE,
  other: PrismaPaymentMethod.OTHER,
};

const methodFromPrisma: Record<PrismaPaymentMethod, PaymentMethod> = {
  CASH: "cash",
  UPI: "upi",
  BANK_TRANSFER: "bank-transfer",
  CARD: "card",
  CHEQUE: "cheque",
  OTHER: "other",
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: InvoiceAutomationService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly inventory: InventoryService,
    @Inject(GST_COMPLIANCE_PROVIDER)
    private readonly compliance: GSTComplianceProvider,
  ) {}

  async settings(businessId: string): Promise<BillingSettings> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { eInvoiceApplicable: true, gstin: true, stateCode: true },
    });
    if (!business) throw new NotFoundException("Business not found");
    return business;
  }

  async updateSettings(
    businessId: string,
    dto: UpdateBillingSettingsDto,
  ): Promise<BillingSettings> {
    const result = await this.prisma.business.updateMany({
      where: { id: businessId, deletedAt: null },
      data: {
        eInvoiceApplicable: dto.eInvoiceApplicable,
        ...(dto.gstin !== undefined ? { gstin: dto.gstin || null } : {}),
        ...(dto.stateCode !== undefined
          ? { stateCode: dto.stateCode || null }
          : {}),
      },
    });
    if (!result.count) throw new NotFoundException("Business not found");
    return this.settings(businessId);
  }

  async options(businessId: string): Promise<BillingOptionsResponse> {
    const [business, contacts, deals] = await Promise.all([
      this.prisma.business.findFirst({
        where: { id: businessId, deletedAt: null },
        select: {
          name: true,
          eInvoiceApplicable: true,
          gstin: true,
          stateCode: true,
          users: {
            where: { role: { in: ["SUPER_ADMIN", "OWNER"] }, deletedAt: null },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { email: true, phone: true },
          },
        },
      }),
      this.prisma.contact.findMany({
        where: { businessId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          creditTermsDays: true,
          gstin: true,
          billingStateCode: true,
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
      this.prisma.deal.findMany({
        where: { businessId, deletedAt: null },
        select: {
          id: true,
          title: true,
          value: true,
          contactId: true,
          contact: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    ]);
    if (!business) throw new NotFoundException("Business not found");
    return {
      eInvoiceApplicable: business.eInvoiceApplicable,
      company: {
        name: business.name,
        email: business.users[0]?.email ?? null,
        phone: business.users[0]?.phone ?? null,
        gstin: business.gstin,
        stateCode: business.stateCode,
      },
      contacts,
      deals: deals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        value: Number(deal.value),
        contactId: deal.contactId,
        contactName: deal.contact.name,
      })),
    };
  }

  async prefill(
    businessId: string,
    dealId: string,
  ): Promise<InvoicePrefillResponse> {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, businessId, deletedAt: null },
      select: {
        id: true,
        title: true,
        value: true,
        contact: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!deal) throw new NotFoundException("Deal not found");
    const quotation = await this.prisma.quotation.findFirst({
      where: { businessId, dealId, deletedAt: null },
      select: { lineItems: true },
      orderBy: { createdAt: "desc" },
    });
    const quotedItems = quotation ? this.lineItems(quotation.lineItems) : [];
    return {
      deal: {
        id: deal.id,
        title: deal.title,
        value: Number(deal.value),
        contact: deal.contact,
      },
      lineItems: quotedItems.length
        ? quotedItems
        : [
            {
              description: deal.title,
              hsnSacCode: "",
              quantity: 1,
              rate: Number(deal.value),
              taxPercent: 18,
            },
          ],
      source: quotedItems.length ? "quotation" : "deal",
    };
  }

  async create(businessId: string, actorId: string, dto: SaveInvoiceDto) {
    await this.assertRelations(businessId, dto.contactId, dto.dealId);
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, businessId, deletedAt: null },
      select: { creditTermsDays: true },
    });
    if (!contact) throw new NotFoundException("Contact not found");
    const totals = this.calculate(dto.lineItems);
    const invoice = await this.prisma.invoice.create({
      data: {
        businessId,
        contactId: dto.contactId,
        dealId: dto.dealId || null,
        lineItems: totals.lineItems as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        dueDate: this.dueDate(dto.dueDate),
        creditTermsDays: contact.creditTermsDays,
        createdById: actorId,
      },
      select: invoiceSelect,
    });
    return this.toDetail(invoice);
  }

  async replace(businessId: string, invoiceId: string, dto: SaveInvoiceDto) {
    const existing = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Invoice not found");
    if (existing.status !== PrismaInvoiceStatus.DRAFT) {
      throw new ConflictException("Issued invoices cannot be edited");
    }
    await this.assertRelations(businessId, dto.contactId, dto.dealId);
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, businessId, deletedAt: null },
      select: { creditTermsDays: true },
    });
    if (!contact) throw new NotFoundException("Contact not found");
    const totals = this.calculate(dto.lineItems);
    await this.prisma.invoice.updateMany({
      where: {
        id: invoiceId,
        businessId,
        status: PrismaInvoiceStatus.DRAFT,
        deletedAt: null,
      },
      data: {
        contactId: dto.contactId,
        dealId: dto.dealId || null,
        lineItems: totals.lineItems as unknown as Prisma.InputJsonValue,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        dueDate: this.dueDate(dto.dueDate),
        creditTermsDays: contact.creditTermsDays,
      },
    });
    return this.findOne(businessId, invoiceId);
  }

  async list(businessId: string, query: ListInvoicesQueryDto) {
    await this.automation.syncOverdue(businessId);
    const where: Prisma.InvoiceWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: statusToPrisma[query.status] } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                contact: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        select: invoiceSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items: items.map((invoice) => this.toSummary(invoice)), total };
  }

  async findOne(businessId: string, invoiceId: string) {
    await this.automation.syncOverdue(businessId);
    const invoice = await this.requireInvoice(businessId, invoiceId);
    return this.toDetail(invoice);
  }

  async issue(businessId: string, actorId: string, invoiceId: string) {
    let invoice = await this.requireInvoice(businessId, invoiceId);
    if (invoice.status === PrismaInvoiceStatus.DRAFT) {
      const issuedAt = new Date();
      await this.prisma.$transaction(async (transaction) => {
        const business = await transaction.business.update({
          where: { id: businessId },
          data: { invoiceSequence: { increment: 1 } },
          select: { invoiceSequence: true },
        });
        const invoiceNumber = this.invoiceNumber(
          issuedAt,
          business.invoiceSequence,
        );
        const updated = await transaction.invoice.updateMany({
          where: {
            id: invoiceId,
            businessId,
            status: PrismaInvoiceStatus.DRAFT,
            deletedAt: null,
          },
          data: {
            invoiceNumber,
            issuedAt,
            status: PrismaInvoiceStatus.SENT,
          },
        });
        if (!updated.count) {
          throw new ConflictException("Invoice has already been issued");
        }
        await this.inventory.consumeForInvoice(
          transaction,
          businessId,
          actorId,
          invoiceId,
          this.lineItems(invoice.lineItems),
        );
      });
      invoice = await this.requireInvoice(businessId, invoiceId);
    }
    if (
      invoice.business.eInvoiceApplicable &&
      invoice.invoiceNumber &&
      (!invoice.irn || !invoice.qrCodeUrl)
    ) {
      const compliance = await this.compliance.generateInvoice({
        businessId,
        businessName: invoice.business.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issuedAt: (invoice.issuedAt ?? invoice.createdAt).toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        customer: invoice.contact,
        lineItems: this.lineItems(invoice.lineItems),
        subtotal: Number(invoice.subtotal),
        taxTotal: Number(invoice.taxTotal),
        grandTotal: Number(invoice.grandTotal),
      });
      await this.prisma.invoice.updateMany({
        where: { id: invoiceId, businessId, deletedAt: null },
        data: { irn: compliance.irn, qrCodeUrl: compliance.qrCodeUrl },
      });
      invoice = await this.requireInvoice(businessId, invoiceId);
    }
    return this.toDetail(invoice);
  }

  async addPayment(
    businessId: string,
    actorId: string,
    invoiceId: string,
    dto: CreatePaymentDto,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const invoice = await transaction.invoice.findFirst({
        where: { id: invoiceId, businessId, deletedAt: null },
        select: {
          id: true,
          status: true,
          grandTotal: true,
          payments: {
            where: { deletedAt: null },
            select: { amount: true },
          },
        },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === PrismaInvoiceStatus.DRAFT) {
        throw new BadRequestException(
          "Issue the invoice before recording payment",
        );
      }
      const paid = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      const remaining = invoice.grandTotal.sub(paid);
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.greaterThan(remaining)) {
        throw new BadRequestException(
          "Payment exceeds the outstanding balance of INR " +
            remaining.toFixed(2),
        );
      }
      await transaction.payment.create({
        data: {
          businessId,
          invoiceId,
          amount,
          method: methodToPrisma[dto.method],
          paidAt: new Date(dto.paidAt),
          recordedById: actorId,
        },
      });
      if (paid.add(amount).greaterThanOrEqualTo(invoice.grandTotal)) {
        await transaction.invoice.updateMany({
          where: { id: invoiceId, businessId, deletedAt: null },
          data: { status: PrismaInvoiceStatus.PAID },
        });
        await transaction.task.updateMany({
          where: {
            businessId,
            relatedEntityType: "INVOICE",
            relatedEntityId: invoiceId,
            status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
            deletedAt: null,
          },
          data: { status: TaskStatus.DONE },
        });
      }
    });
    return this.findOne(businessId, invoiceId);
  }

  async aging(
    businessId: string,
    now = new Date(),
  ): Promise<ReceivablesAgingSummary> {
    await this.automation.syncOverdue(businessId, now);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: { in: [PrismaInvoiceStatus.SENT, PrismaInvoiceStatus.OVERDUE] },
      },
      select: {
        dueDate: true,
        grandTotal: true,
        payments: {
          where: { deletedAt: null },
          select: { amount: true },
        },
      },
    });
    const today = this.indiaDate(now);
    const summary: ReceivablesAgingSummary = {
      outstanding: 0,
      overdue: 0,
      buckets: { current: 0, days0To30: 0, days31To60: 0, days60Plus: 0 },
    };
    for (const invoice of invoices) {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const balance = Math.max(0, Number(invoice.grandTotal) - paid);
      summary.outstanding += balance;
      const days = Math.floor(
        (today.getTime() - invoice.dueDate.getTime()) / 86_400_000,
      );
      if (days <= 0) summary.buckets.current += balance;
      else {
        summary.overdue += balance;
        if (days <= 30) summary.buckets.days0To30 += balance;
        else if (days <= 60) summary.buckets.days31To60 += balance;
        else summary.buckets.days60Plus += balance;
      }
    }
    return this.roundSummary(summary);
  }

  async customerReceivables(
    businessId: string,
    now = new Date(),
  ): Promise<CustomerReceivableSummary[]> {
    await this.automation.syncOverdue(businessId, now);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: { in: [PrismaInvoiceStatus.SENT, PrismaInvoiceStatus.OVERDUE] },
      },
      select: {
        dueDate: true,
        grandTotal: true,
        creditTermsBreachedAt: true,
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            creditTermsDays: true,
          },
        },
        payments: {
          where: { deletedAt: null },
          select: { amount: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const today = this.indiaDate(now);
    const summaries = new Map<string, CustomerReceivableSummary>();
    for (const invoice of invoices) {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const balance = Math.max(0, Number(invoice.grandTotal) - paid);
      if (!balance) continue;
      const current = summaries.get(invoice.contact.id) ?? {
        contact: {
          id: invoice.contact.id,
          name: invoice.contact.name,
          phone: invoice.contact.phone,
        },
        creditTermsDays: invoice.contact.creditTermsDays,
        outstanding: 0,
        overdue: 0,
        breached: false,
        oldestDueDate: null,
      };
      current.outstanding += balance;
      if (invoice.dueDate < today) current.overdue += balance;
      current.breached ||= Boolean(invoice.creditTermsBreachedAt);
      const dueDate = invoice.dueDate.toISOString().slice(0, 10);
      if (!current.oldestDueDate || dueDate < current.oldestDueDate) {
        current.oldestDueDate = dueDate;
      }
      summaries.set(invoice.contact.id, current);
    }
    return [...summaries.values()]
      .map((item) => ({
        ...item,
        outstanding: this.round(item.outstanding),
        overdue: this.round(item.overdue),
      }))
      .sort((left, right) => right.overdue - left.overdue);
  }

  async gstr1(businessId: string, query: Gstr1QueryDto) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { gstin: true, stateCode: true },
    });
    if (!business) throw new NotFoundException("Business not found");
    const issuedAt: Prisma.DateTimeNullableFilter = {
      not: null,
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        deletedAt: null,
        invoiceNumber: { not: null },
        issuedAt,
        status: {
          in: [
            PrismaInvoiceStatus.SENT,
            PrismaInvoiceStatus.PAID,
            PrismaInvoiceStatus.OVERDUE,
          ],
        },
      },
      select: {
        invoiceNumber: true,
        issuedAt: true,
        grandTotal: true,
        lineItems: true,
        contact: {
          select: { name: true, gstin: true, billingStateCode: true },
        },
      },
      orderBy: { issuedAt: "asc" },
    });
    const rows: Array<Array<string | number>> = [
      [
        "GSTIN/UIN of Recipient",
        "Receiver Name",
        "Invoice Number",
        "Invoice Date",
        "Invoice Value",
        "Place Of Supply",
        "Reverse Charge",
        "Invoice Type",
        "Rate",
        "Taxable Value",
        "Integrated Tax",
        "Central Tax",
        "State/UT Tax",
        "HSN/SAC",
        "Quantity",
      ],
    ];
    for (const invoice of invoices) {
      for (const item of this.lineItems(invoice.lineItems)) {
        const taxable = this.round(item.quantity * item.rate);
        const tax = this.round((taxable * item.taxPercent) / 100);
        const interstate = Boolean(
          business.stateCode &&
          invoice.contact.billingStateCode &&
          business.stateCode !== invoice.contact.billingStateCode,
        );
        rows.push([
          invoice.contact.gstin || "",
          invoice.contact.name,
          invoice.invoiceNumber || "",
          invoice.issuedAt?.toISOString().slice(0, 10) || "",
          Number(invoice.grandTotal),
          invoice.contact.billingStateCode || "",
          "N",
          invoice.contact.gstin ? "Regular" : "B2C",
          item.taxPercent,
          taxable,
          interstate ? tax : 0,
          interstate ? 0 : this.round(tax / 2),
          interstate ? 0 : this.round(tax / 2),
          item.hsnSacCode,
          item.quantity,
        ]);
      }
    }
    const csv =
      "\uFEFF" +
      rows
        .map((row) => row.map((value) => this.csvCell(value)).join(","))
        .join("\r\n");
    const suffix = [query.from, query.to].filter(Boolean).join("-to-") || "all";
    return { filename: `gstr1-${suffix}.csv`, csv };
  }

  async pdf(businessId: string, invoiceId: string) {
    const invoice = await this.requireInvoice(businessId, invoiceId);
    const detail = this.toDetail(invoice);
    const buffer = await this.invoicePdf.generate({
      invoiceId: detail.id,
      businessName: invoice.business.name,
      businessEmail: invoice.business.users[0]?.email ?? null,
      businessPhone: invoice.business.users[0]?.phone ?? null,
      businessGstin: invoice.business.gstin,
      businessStateCode: invoice.business.stateCode,
      invoiceNumber: detail.invoiceNumber,
      status: detail.status,
      issuedAt: detail.issuedAt,
      createdAt: detail.createdAt,
      dueDate: detail.dueDate,
      contact: invoice.contact,
      lineItems: detail.lineItems,
      subtotal: detail.subtotal,
      discountTotal: detail.discountTotal,
      taxTotal: detail.taxTotal,
      grandTotal: detail.grandTotal,
      amountPaid: detail.amountPaid,
      balanceDue: detail.balanceDue,
      payments: detail.payments,
      irn: detail.irn,
      qrCodeUrl: detail.qrCodeUrl,
    });
    return {
      buffer,
      filename: (detail.invoiceNumber ?? "draft-invoice") + ".pdf",
    };
  }

  async remove(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId, deletedAt: null },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status !== PrismaInvoiceStatus.DRAFT) {
      throw new ConflictException("Issued invoices cannot be deleted");
    }
    await this.prisma.invoice.updateMany({
      where: { id: invoiceId, businessId, status: PrismaInvoiceStatus.DRAFT },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  private async requireInvoice(businessId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId, deletedAt: null },
      select: invoiceSelect,
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  private async assertRelations(
    businessId: string,
    contactId: string,
    dealId?: string | null,
  ) {
    const [contact, deal] = await Promise.all([
      this.prisma.contact.findFirst({
        where: { id: contactId, businessId, deletedAt: null },
        select: { id: true },
      }),
      dealId
        ? this.prisma.deal.findFirst({
            where: { id: dealId, businessId, deletedAt: null },
            select: { id: true, contactId: true },
          })
        : null,
    ]);
    if (!contact) throw new BadRequestException("Selected contact not found");
    if (dealId && !deal)
      throw new BadRequestException("Selected deal not found");
    if (deal && deal.contactId !== contactId) {
      throw new BadRequestException(
        "Deal does not belong to the selected contact",
      );
    }
  }

  private calculate(items: SaveInvoiceDto["lineItems"]) {
    const lineItems: InvoiceLineItem[] = items.map((item) => ({
      ...(item.inventoryItemId ? { inventoryItemId: item.inventoryItemId } : {}),
      description: item.description.trim(),
      hsnSacCode: item.hsnSacCode.trim().toUpperCase(),
      quantity: item.quantity,
      rate: item.rate,
      discountPercent: item.discountPercent ?? 0,
      taxPercent: item.taxPercent,
    }));
    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    for (const item of lineItems) {
      const base = new Prisma.Decimal(item.quantity)
        .mul(item.rate)
        .toDecimalPlaces(2);
      const discount = base
        .mul(item.discountPercent ?? 0)
        .div(100)
        .toDecimalPlaces(2);
      const taxable = base.sub(discount).toDecimalPlaces(2);
      const tax = taxable
        .mul(item.taxPercent)
        .div(100)
        .toDecimalPlaces(2);
      item.discountAmount = Number(discount);
      item.taxableAmount = Number(taxable);
      item.lineTotal = Number(taxable.add(tax).toDecimalPlaces(2));
      subtotal = subtotal.add(base);
      discountTotal = discountTotal.add(discount);
      taxTotal = taxTotal.add(tax);
    }
    return {
      lineItems,
      subtotal: subtotal.toDecimalPlaces(2),
      discountTotal: discountTotal.toDecimalPlaces(2),
      taxTotal: taxTotal.toDecimalPlaces(2),
      grandTotal: subtotal
        .sub(discountTotal)
        .add(taxTotal)
        .toDecimalPlaces(2),
    };
  }

  private lineItems(value: Prisma.JsonValue): InvoiceLineItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((candidate) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        return [];
      }
      const item = candidate as Record<string, unknown>;
      if (
        typeof item.description !== "string" ||
        typeof item.hsnSacCode !== "string" ||
        typeof item.quantity !== "number" ||
        typeof item.rate !== "number" ||
        typeof item.taxPercent !== "number"
      ) {
        return [];
      }
      return [
        {
          ...(typeof item.inventoryItemId === "string"
            ? { inventoryItemId: item.inventoryItemId }
            : {}),
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          rate: item.rate,
          discountPercent:
            typeof item.discountPercent === "number" ? item.discountPercent : 0,
          discountAmount:
            typeof item.discountAmount === "number" ? item.discountAmount : undefined,
          taxableAmount:
            typeof item.taxableAmount === "number" ? item.taxableAmount : undefined,
          lineTotal:
            typeof item.lineTotal === "number" ? item.lineTotal : undefined,
          taxPercent: item.taxPercent,
        },
      ];
    });
  }

  private csvCell(value: string | number) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private toSummary(invoice: InvoiceRecord): InvoiceSummary {
    const amountPaid = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const grandTotal = Number(invoice.grandTotal);
    const discountTotal = this.lineItems(invoice.lineItems).reduce(
      (sum, item) => sum + (item.discountAmount ?? 0),
      0,
    );
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: statusFromPrisma[invoice.status],
      contact: {
        id: invoice.contact.id,
        name: invoice.contact.name,
        phone: invoice.contact.phone,
        email: invoice.contact.email,
      },
      deal: invoice.deal,
      subtotal: Number(invoice.subtotal),
      discountTotal: this.round(discountTotal),
      taxTotal: Number(invoice.taxTotal),
      grandTotal,
      amountPaid: this.round(amountPaid),
      balanceDue: this.round(Math.max(0, grandTotal - amountPaid)),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      creditTermsDays: invoice.creditTermsDays,
      creditTermsBreached: Boolean(invoice.creditTermsBreachedAt),
      creditTermsBreachedAt:
        invoice.creditTermsBreachedAt?.toISOString() ?? null,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  private toDetail(invoice: InvoiceRecord): InvoiceDetail {
    return {
      ...this.toSummary(invoice),
      company: {
        name: invoice.business.name,
        email: invoice.business.users[0]?.email ?? null,
        phone: invoice.business.users[0]?.phone ?? null,
        gstin: invoice.business.gstin,
        stateCode: invoice.business.stateCode,
      },
      lineItems: this.lineItems(invoice.lineItems),
      irn: invoice.irn,
      qrCodeUrl: invoice.qrCodeUrl,
      eInvoiceApplicable: invoice.business.eInvoiceApplicable,
      payments: invoice.payments.map((payment) => this.toPayment(payment)),
    };
  }

  private toPayment(payment: PaymentRecord): PaymentSummary {
    return {
      id: payment.id,
      amount: Number(payment.amount),
      method: methodFromPrisma[payment.method],
      paidAt: payment.paidAt.toISOString(),
      recordedBy: payment.recordedBy,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private dueDate(value: string) {
    const date = new Date(value.slice(0, 10) + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Due date is invalid");
    }
    return date;
  }

  private invoiceNumber(date: Date, sequence: number) {
    const year = new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date);
    return "INV-" + year + "-" + String(sequence).padStart(6, "0");
  }

  private indiaDate(now: Date) {
    const india = new Date(now.getTime() + 330 * 60 * 1000);
    return new Date(
      Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()),
    );
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private roundSummary(summary: ReceivablesAgingSummary) {
    return {
      outstanding: this.round(summary.outstanding),
      overdue: this.round(summary.overdue),
      buckets: {
        current: this.round(summary.buckets.current),
        days0To30: this.round(summary.buckets.days0To30),
        days31To60: this.round(summary.buckets.days31To60),
        days60Plus: this.round(summary.buckets.days60Plus),
      },
    };
  }
}
