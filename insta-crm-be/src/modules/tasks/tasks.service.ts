import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RelatedEntityType,
  TaskSource as PrismaTaskSource,
  TaskStatus as PrismaTaskStatus,
} from "@prisma/client";
import type {
  TaskRelatedEntityType,
  TaskSource,
  TaskStatus,
  TaskSummary,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";

const taskSelect = {
  id: true,
  title: true,
  dueAt: true,
  status: true,
  source: true,
  relatedEntityType: true,
  relatedEntityId: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

type TaskRecord = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

const entityToPrisma: Record<TaskRelatedEntityType, RelatedEntityType> = {
  contact: RelatedEntityType.CONTACT,
  deal: RelatedEntityType.DEAL,
  invoice: RelatedEntityType.INVOICE,
};

const entityFromPrisma: Record<RelatedEntityType, TaskRelatedEntityType> = {
  CONTACT: "contact",
  DEAL: "deal",
  INVOICE: "invoice",
};

const statusToPrisma: Record<TaskStatus, PrismaTaskStatus> = {
  pending: PrismaTaskStatus.PENDING,
  done: PrismaTaskStatus.DONE,
  overdue: PrismaTaskStatus.OVERDUE,
};

const statusFromPrisma: Record<PrismaTaskStatus, TaskStatus> = {
  PENDING: "pending",
  DONE: "done",
  OVERDUE: "overdue",
};

const sourceFromPrisma: Record<PrismaTaskSource, TaskSource> = {
  MANUAL: "manual",
  CONTACT_CREATED: "contact-created",
  STALE_DEAL_STAGE: "stale-deal-stage",
  PAYMENT_REMINDER: "payment-reminder",
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async options(businessId: string, actor: JwtPayload) {
    const users = await this.prisma.user.findMany({
      where: {
        businessId,
        deletedAt: null,
        role: { in: ["SUPER_ADMIN", "OWNER", "STAFF"] },
        ...(actor.role === "STAFF" ? { id: actor.sub } : {}),
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return { users };
  }

  async create(businessId: string, actor: JwtPayload, dto: CreateTaskDto) {
    if (
      actor.role === "STAFF" &&
      dto.assignedToId &&
      dto.assignedToId !== actor.sub
    ) {
      throw new ForbiddenException("Staff cannot assign tasks to another user");
    }
    const assignedToId =
      actor.role === "STAFF" ? actor.sub : (dto.assignedToId ?? actor.sub);
    await Promise.all([
      this.assertUser(businessId, assignedToId),
      this.assertRelatedEntity(
        businessId,
        actor,
        dto.relatedEntityType,
        dto.relatedEntityId,
      ),
    ]);
    const task = await this.prisma.task.create({
      data: {
        businessId,
        title: dto.title,
        dueAt: new Date(dto.dueAt),
        status:
          new Date(dto.dueAt).getTime() < Date.now()
            ? PrismaTaskStatus.OVERDUE
            : PrismaTaskStatus.PENDING,
        assignedToId,
        relatedEntityType: entityToPrisma[dto.relatedEntityType],
        relatedEntityId: dto.relatedEntityId,
      },
      select: taskSelect,
    });
    return (await this.toResponses(businessId, [task]))[0];
  }

  async list(businessId: string, actor: JwtPayload, query: ListTasksQueryDto) {
    if (
      (query.relatedEntityType && !query.relatedEntityId) ||
      (!query.relatedEntityType && query.relatedEntityId)
    ) {
      throw new BadRequestException(
        "Related entity type and ID must be provided together",
      );
    }
    await this.markOverdue(
      businessId,
      new Date(),
      actor.role === "STAFF" ? actor.sub : undefined,
    );
    const where: Prisma.TaskWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status
        ? { status: statusToPrisma[query.status] }
        : {
            status: {
              in: [PrismaTaskStatus.PENDING, PrismaTaskStatus.OVERDUE],
            },
          }),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...this.assignmentScope(actor),
      ...(query.relatedEntityType && query.relatedEntityId
        ? {
            relatedEntityType: entityToPrisma[query.relatedEntityType],
            relatedEntityId: query.relatedEntityId,
          }
        : {}),
    };
    const tasks = await this.prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: query.limit,
    });
    return this.toResponses(businessId, tasks);
  }

  async today(businessId: string, actor: JwtPayload, now = new Date()) {
    await this.markOverdue(
      businessId,
      now,
      actor.role === "STAFF" ? actor.sub : undefined,
    );
    const { end } = this.indiaDayBounds(now);
    const tasks = await this.prisma.task.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
        status: { in: [PrismaTaskStatus.PENDING, PrismaTaskStatus.OVERDUE] },
        dueAt: { lt: end },
      },
      select: taskSelect,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    });
    return this.toResponses(businessId, tasks);
  }

  async update(
    businessId: string,
    actor: JwtPayload,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException("Task not found");
    if (
      actor.role === "STAFF" &&
      dto.assignedToId &&
      dto.assignedToId !== actor.sub
    ) {
      throw new ForbiddenException("Staff cannot reassign tasks");
    }
    if (dto.assignedToId) {
      await this.assertUser(businessId, dto.assignedToId);
    }

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    await this.prisma.task.updateMany({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dueAt !== undefined ? { dueAt } : {}),
        ...(dto.assignedToId !== undefined
          ? { assignedToId: dto.assignedToId }
          : {}),
        ...(dueAt && existing.status !== PrismaTaskStatus.DONE
          ? {
              status:
                dueAt.getTime() < Date.now()
                  ? PrismaTaskStatus.OVERDUE
                  : PrismaTaskStatus.PENDING,
            }
          : {}),
      },
    });
    return this.findOne(businessId, actor, taskId);
  }

  async setStatus(
    businessId: string,
    actor: JwtPayload,
    taskId: string,
    status: "pending" | "done",
  ) {
    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: { id: true, dueAt: true },
    });
    if (!existing) throw new NotFoundException("Task not found");
    const nextStatus =
      status === "done"
        ? PrismaTaskStatus.DONE
        : existing.dueAt.getTime() < Date.now()
          ? PrismaTaskStatus.OVERDUE
          : PrismaTaskStatus.PENDING;
    await this.prisma.task.updateMany({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: { status: nextStatus },
    });
    return this.findOne(businessId, actor, taskId);
  }

  async remove(businessId: string, actor: JwtPayload, taskId: string) {
    const result = await this.prisma.task.updateMany({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException("Task not found");
    return { success: true };
  }

  async markOverdue(
    businessId: string,
    now = new Date(),
    assignedToId?: string,
  ) {
    return this.prisma.task.updateMany({
      where: {
        businessId,
        deletedAt: null,
        status: PrismaTaskStatus.PENDING,
        dueAt: { lt: now },
        ...(assignedToId ? { assignedToId } : {}),
      },
      data: { status: PrismaTaskStatus.OVERDUE },
    });
  }

  private async findOne(
    businessId: string,
    actor: JwtPayload,
    taskId: string,
  ): Promise<TaskSummary> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: taskSelect,
    });
    if (!task) throw new NotFoundException("Task not found");
    return (await this.toResponses(businessId, [task]))[0];
  }

  private async assertUser(businessId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new BadRequestException("Assignee not found");
  }

  private async assertRelatedEntity(
    businessId: string,
    actor: JwtPayload,
    type: TaskRelatedEntityType,
    entityId: string,
  ) {
    if (type === "contact") {
      const contact = await this.prisma.contact.findFirst({
        where: {
          id: entityId,
          businessId,
          deletedAt: null,
          ...(actor.role === "STAFF" ? { assignedToId: actor.sub } : {}),
        },
        select: { id: true },
      });
      if (!contact) throw new BadRequestException("Contact not found");
      return;
    }
    if (type === "deal") {
      const deal = await this.prisma.deal.findFirst({
        where: {
          id: entityId,
          businessId,
          deletedAt: null,
          ...this.assignmentScope(actor),
        },
        select: { id: true },
      });
      if (!deal) throw new BadRequestException("Deal not found");
      return;
    }
    if (actor.role === "STAFF") {
      throw new ForbiddenException("Staff cannot create invoice tasks");
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: entityId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!invoice) throw new BadRequestException("Invoice not found");
  }

  private assignmentScope(actor: JwtPayload): { assignedToId?: string } {
    return actor.role === "STAFF" ? { assignedToId: actor.sub } : {};
  }

  private async toResponses(
    businessId: string,
    tasks: TaskRecord[],
  ): Promise<TaskSummary[]> {
    const contactIds = tasks
      .filter((task) => task.relatedEntityType === RelatedEntityType.CONTACT)
      .map((task) => task.relatedEntityId);
    const dealIds = tasks
      .filter((task) => task.relatedEntityType === RelatedEntityType.DEAL)
      .map((task) => task.relatedEntityId);
    const invoiceIds = tasks
      .filter((task) => task.relatedEntityType === RelatedEntityType.INVOICE)
      .map((task) => task.relatedEntityId);
    const [contacts, deals, invoices] = await Promise.all([
      contactIds.length
        ? this.prisma.contact.findMany({
            where: { businessId, id: { in: contactIds } },
            select: { id: true, name: true },
          })
        : [],
      dealIds.length
        ? this.prisma.deal.findMany({
            where: { businessId, id: { in: dealIds } },
            select: { id: true, title: true },
          })
        : [],
      invoiceIds.length
        ? this.prisma.invoice.findMany({
            where: { businessId, id: { in: invoiceIds } },
            select: { id: true, invoiceNumber: true },
          })
        : [],
    ]);
    const contactLabels = new Map(
      contacts.map((contact) => [contact.id, contact.name]),
    );
    const dealLabels = new Map(deals.map((deal) => [deal.id, deal.title]));
    const invoiceLabels = new Map(
      invoices.map((invoice) => [
        invoice.id,
        invoice.invoiceNumber ?? "Draft invoice",
      ]),
    );

    return tasks.map((task) => {
      const type = entityFromPrisma[task.relatedEntityType];
      const label =
        type === "contact"
          ? (contactLabels.get(task.relatedEntityId) ?? "Contact")
          : type === "deal"
            ? (dealLabels.get(task.relatedEntityId) ?? "Deal")
            : (invoiceLabels.get(task.relatedEntityId) ?? "Invoice");
      const href =
        type === "contact"
          ? "/contacts/" + task.relatedEntityId
          : type === "deal"
            ? "/pipeline/" + task.relatedEntityId + "/edit"
            : "/invoices/" + task.relatedEntityId;
      return {
        id: task.id,
        title: task.title,
        dueAt: task.dueAt.toISOString(),
        status: statusFromPrisma[task.status],
        source: sourceFromPrisma[task.source],
        assignedTo: task.assignedTo,
        relatedEntity: {
          type,
          id: task.relatedEntityId,
          label,
          href,
        },
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });
  }

  private indiaDayBounds(now: Date) {
    const indiaOffsetMs = 330 * 60 * 1000;
    const indiaNow = new Date(now.getTime() + indiaOffsetMs);
    const start = new Date(
      Date.UTC(
        indiaNow.getUTCFullYear(),
        indiaNow.getUTCMonth(),
        indiaNow.getUTCDate(),
      ) - indiaOffsetMs,
    );
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }
}
