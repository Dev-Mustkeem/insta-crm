import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ContactSource as PrismaContactSource,
  TaskStatus,
} from "@prisma/client";
import {
  CONTACT_SOURCES,
  type ContactSource,
  type DashboardDigestFrequency,
  type DashboardSummary,
  type LeadSourceMetric,
  type TopCustomerMetric,
} from "@insta-crm/shared-types";
import {
  startOfBusinessMonth,
  startOfBusinessWeek,
} from "../../common/time/business-calendar";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { TasksService } from "../tasks/tasks.service";

const sourceFromPrisma: Record<PrismaContactSource, ContactSource> = {
  GMAIL: "gmail",
  WHATSAPP: "whatsapp",
  WEBSITE: "website",
  MARKETPLACE: "marketplace",
  WALK_IN: "walk-in",
  REFERRAL: "referral",
  OTHER: "other",
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly tasks: TasksService,
  ) {}

  async summary(
    businessId: string,
    now = new Date(),
  ): Promise<DashboardSummary> {
    const business = await this.business(businessId);
    await this.tasks.markOverdue(businessId, now);
    const monthStart = startOfBusinessMonth(now, business.timezone);
    const [openPipeline, wonThisMonth, overdueTasks, receivables] =
      await Promise.all([
        this.prisma.deal.aggregate({
          where: {
            businessId,
            deletedAt: null,
            stage: { is: { isWon: false, isLost: false, deletedAt: null } },
          },
          _sum: { value: true },
          _count: { _all: true },
        }),
        this.prisma.deal.aggregate({
          where: {
            businessId,
            deletedAt: null,
            stageChangedAt: { gte: monthStart, lte: now },
            stage: { is: { isWon: true, deletedAt: null } },
          },
          _sum: { value: true },
          _count: { _all: true },
        }),
        this.prisma.task.count({
          where: {
            businessId,
            deletedAt: null,
            status: TaskStatus.OVERDUE,
            dueAt: { lt: now },
          },
        }),
        this.billing.aging(businessId, now),
      ]);
    return {
      openPipeline: {
        value: Number(openPipeline._sum.value ?? 0),
        count: openPipeline._count._all,
      },
      wonThisMonth: {
        value: Number(wonThisMonth._sum.value ?? 0),
        count: wonThisMonth._count._all,
      },
      overdueTasks,
      receivables,
    };
  }

  async topCustomers(businessId: string): Promise<TopCustomerMetric[]> {
    await this.business(businessId);
    const leaders = await this.prisma.deal.groupBy({
      by: ["contactId"],
      where: { businessId, deletedAt: null },
      _sum: { value: true },
      _count: { _all: true },
      orderBy: { _sum: { value: "desc" } },
      take: 5,
    });
    if (!leaders.length) return [];
    const contacts = await this.prisma.contact.findMany({
      where: {
        businessId,
        deletedAt: null,
        id: { in: leaders.map((leader) => leader.contactId) },
      },
      select: { id: true, name: true, phone: true },
    });
    const contactById = new Map(
      contacts.map((contact) => [contact.id, contact]),
    );
    return leaders.flatMap((leader) => {
      const contact = contactById.get(leader.contactId);
      return contact
        ? [
            {
              contact,
              dealValue: Number(leader._sum.value ?? 0),
              dealCount: leader._count._all,
            },
          ]
        : [];
    });
  }

  async newLeads(
    businessId: string,
    now = new Date(),
  ): Promise<LeadSourceMetric[]> {
    const business = await this.business(businessId);
    const weekStart = startOfBusinessWeek(now, business.timezone);
    const grouped = await this.prisma.contact.groupBy({
      by: ["source"],
      where: {
        businessId,
        deletedAt: null,
        createdAt: { gte: weekStart, lte: now },
      },
      _count: { _all: true },
      orderBy: { source: "asc" },
    });
    const counts = new Map(
      grouped.map((item) => [sourceFromPrisma[item.source], item._count._all]),
    );
    return CONTACT_SOURCES.map((source) => ({
      source,
      count: counts.get(source) ?? 0,
    }));
  }

  async digest(
    businessId: string,
    frequency: DashboardDigestFrequency,
    now = new Date(),
  ) {
    const [summary, customers, leads] = await Promise.all([
      this.summary(businessId, now),
      this.topCustomers(businessId),
      this.newLeads(businessId, now),
    ]);
    const newLeads = leads.reduce((sum, item) => sum + item.count, 0);
    const money = (value: number) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value);
    const heading =
      frequency === "weekly" ? "Monday overview" : "Daily overview";
    const lines = [
      heading,
      `Open pipeline: ${money(summary.openPipeline.value)} (${summary.openPipeline.count} deals)`,
      `Won this month: ${money(summary.wonThisMonth.value)} (${summary.wonThisMonth.count})`,
      `Overdue tasks: ${summary.overdueTasks}`,
      `Receivables: ${money(summary.receivables.outstanding)} (${money(summary.receivables.overdue)} overdue)`,
      `New leads this week: ${newLeads}`,
    ];
    if (customers[0]) {
      lines.push(
        `Top customer: ${customers[0].contact.name} (${money(customers[0].dealValue)})`,
      );
    }
    return { message: lines.join("\n"), summary, customers, leads };
  }

  private async business(businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true, timezone: true },
    });
    if (!business) throw new NotFoundException("Business not found");
    return business;
  }
}
