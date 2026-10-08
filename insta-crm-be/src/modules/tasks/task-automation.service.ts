import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RelatedEntityType, TaskSource, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InvoiceAutomationService } from "../billing/invoice-automation.service";
import { STALE_DEAL_DAYS } from "./tasks.constants";
import { TasksService } from "./tasks.service";

@Injectable()
export class TaskAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly invoices: InvoiceAutomationService,
  ) {}

  /**
   * Runs PostgreSQL-backed maintenance once per day without a Redis queue.
   *
   * @param now - The timestamp used to evaluate overdue records.
   * @returns Aggregated maintenance counts for all active businesses.
   * @throws Error when a database operation fails.
   */
  @Cron("5 0 * * *", { timeZone: "Asia/Kolkata" })
  async runDaily(now = new Date()) {
    const businesses = await this.prisma.business.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    let staleTasksCreated = 0;
    let tasksMarkedOverdue = 0;
    let remindersQueued = 0;
    let invoicesMarkedOverdue = 0;
    let paymentReminderTasksCreated = 0;

    for (const business of businesses) {
      staleTasksCreated += await this.createStaleDealTasks(business.id, now);
      const invoiceResult = await this.invoices.syncOverdue(business.id, now);
      invoicesMarkedOverdue += invoiceResult.invoicesMarkedOverdue;
      paymentReminderTasksCreated += invoiceResult.reminderTasksCreated;
      const overdue = await this.tasks.markOverdue(business.id, now);
      tasksMarkedOverdue += overdue.count;
    }

    return {
      businessesProcessed: businesses.length,
      staleTasksCreated,
      invoicesMarkedOverdue,
      paymentReminderTasksCreated,
      tasksMarkedOverdue,
    };
  }

  private async createStaleDealTasks(businessId: string, now: Date) {
    const staleBefore = new Date(
      now.getTime() - STALE_DEAL_DAYS * 24 * 60 * 60 * 1000,
    );
    const deals = await this.prisma.deal.findMany({
      where: {
        businessId,
        deletedAt: null,
        stageChangedAt: { lte: staleBefore },
        stage: {
          is: { isWon: false, isLost: false, deletedAt: null },
        },
      },
      select: {
        id: true,
        title: true,
        assignedToId: true,
        stageChangedAt: true,
        stage: { select: { name: true } },
      },
    });
    if (!deals.length) return 0;

    const previousTasks = await this.prisma.task.findMany({
      where: {
        businessId,
        deletedAt: null,
        source: TaskSource.STALE_DEAL_STAGE,
        relatedEntityType: RelatedEntityType.DEAL,
        relatedEntityId: { in: deals.map((deal) => deal.id) },
      },
      select: { relatedEntityId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const latestTaskByDeal = new Map<string, Date>();
    for (const task of previousTasks) {
      if (!latestTaskByDeal.has(task.relatedEntityId)) {
        latestTaskByDeal.set(task.relatedEntityId, task.createdAt);
      }
    }
    const missing = deals.filter((deal) => {
      const latestTask = latestTaskByDeal.get(deal.id);
      return !latestTask || latestTask < deal.stageChangedAt;
    });
    if (!missing.length) return 0;

    const result = await this.prisma.task.createMany({
      data: missing.map((deal) => ({
        businessId,
        title: "Follow up: " + deal.title + " (" + deal.stage.name + ")",
        dueAt: now,
        assignedToId: deal.assignedToId,
        relatedEntityType: RelatedEntityType.DEAL,
        relatedEntityId: deal.id,
        source: TaskSource.STALE_DEAL_STAGE,
      })),
    });
    return result.count;
  }
}
