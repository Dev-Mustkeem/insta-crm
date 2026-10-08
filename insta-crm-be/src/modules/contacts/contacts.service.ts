import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ContactSource as PrismaContactSource,
  Prisma,
  RelatedEntityType,
  TaskSource,
} from "@prisma/client";
import type {
  ContactDuplicateWarning,
  ContactSource,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";
import { normalizePhone } from "./contacts.utils";

const contactSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  source: true,
  tags: true,
  customFields: true,
  creditTermsDays: true,
  gstin: true,
  billingStateCode: true,
  whatsappOptedOut: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.ContactSelect;

type ContactRecord = Prisma.ContactGetPayload<{ select: typeof contactSelect }>;

const sourceToPrisma: Record<ContactSource, PrismaContactSource> = {
  gmail: PrismaContactSource.GMAIL,
  whatsapp: PrismaContactSource.WHATSAPP,
  website: PrismaContactSource.WEBSITE,
  marketplace: PrismaContactSource.MARKETPLACE,
  "walk-in": PrismaContactSource.WALK_IN,
  referral: PrismaContactSource.REFERRAL,
  other: PrismaContactSource.OTHER,
};

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
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async options(businessId: string, actor: JwtPayload) {
    return this.prisma.user.findMany({
      where: {
        businessId,
        deletedAt: null,
        role: { in: ["SUPER_ADMIN", "OWNER", "STAFF"] },
        ...(actor.role === "STAFF" ? { id: actor.sub } : {}),
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  }

  async create(businessId: string, actor: JwtPayload, dto: CreateContactDto) {
    const assignedToId =
      actor.role === "STAFF" ? actor.sub : (dto.assignedToId ?? actor.sub);
    await this.assertAssignableUser(businessId, assignedToId);
    const normalizedPhone = normalizePhone(dto.phone);
    const duplicate = await this.findDuplicate(businessId, normalizedPhone);
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const contact = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.contact.create({
        data: {
          businessId,
          createdById: actor.sub,
          assignedToId,
          name: dto.name,
          phone: dto.phone,
          normalizedPhone,
          email: dto.email,
          source: sourceToPrisma[dto.source ?? "other"],
          tags: this.normalizeTags(dto.tags),
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          creditTermsDays: dto.creditTermsDays,
          gstin: dto.gstin,
          billingStateCode: dto.billingStateCode,
        },
        select: contactSelect,
      });
      await transaction.task.create({
        data: {
          businessId,
          title: "Follow up with " + created.name,
          dueAt,
          assignedToId,
          relatedEntityType: RelatedEntityType.CONTACT,
          relatedEntityId: created.id,
          source: TaskSource.CONTACT_CREATED,
        },
      });
      return created;
    });

    return {
      contact: (await this.withScores(businessId, [contact]))[0],
      warnings: this.duplicateWarnings(duplicate, actor),
    };
  }

  async list(
    businessId: string,
    actor: JwtPayload,
    query: ListContactsQueryDto,
  ) {
    const where: Prisma.ContactWhereInput = {
      businessId,
      deletedAt: null,
      ...this.assignmentScope(actor),
      ...(query.source ? { source: sourceToPrisma[query.source] } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        select: contactSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: query.limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      items: await this.withScores(businessId, items),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async findOne(businessId: string, actor: JwtPayload, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: contactSelect,
    });
    if (!contact) throw new NotFoundException("Contact not found");
    return (await this.withScores(businessId, [contact]))[0];
  }

  async update(
    businessId: string,
    actor: JwtPayload,
    contactId: string,
    dto: UpdateContactDto,
  ) {
    const existing = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: { id: true, normalizedPhone: true, source: true, email: true },
    });
    if (!existing) throw new NotFoundException("Contact not found");
    const nextSource = dto.source ? sourceToPrisma[dto.source] : existing.source;
    const nextEmail = dto.email !== undefined ? dto.email : existing.email;
    if (nextSource === PrismaContactSource.GMAIL && !nextEmail) {
      throw new BadRequestException("Add the contact's email address before saving a Gmail contact");
    }
    if (
      actor.role === "STAFF" &&
      dto.assignedToId &&
      dto.assignedToId !== actor.sub
    ) {
      throw new ForbiddenException("Staff cannot reassign contacts");
    }
    if (dto.assignedToId) {
      await this.assertAssignableUser(businessId, dto.assignedToId);
    }

    const normalizedPhone = dto.phone
      ? normalizePhone(dto.phone)
      : existing.normalizedPhone;
    const duplicate = dto.phone
      ? await this.findDuplicate(businessId, normalizedPhone, contactId)
      : null;

    await this.prisma.contact.updateMany({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone, normalizedPhone }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.source !== undefined
          ? { source: sourceToPrisma[dto.source] }
          : {}),
        ...(dto.tags !== undefined
          ? { tags: this.normalizeTags(dto.tags) }
          : {}),
        ...(dto.customFields !== undefined
          ? { customFields: dto.customFields as Prisma.InputJsonValue }
          : {}),
        ...(dto.assignedToId !== undefined
          ? { assignedToId: dto.assignedToId }
          : {}),
        ...(dto.creditTermsDays !== undefined
          ? { creditTermsDays: dto.creditTermsDays }
          : {}),
        ...(dto.gstin !== undefined ? { gstin: dto.gstin } : {}),
        ...(dto.billingStateCode !== undefined
          ? { billingStateCode: dto.billingStateCode }
          : {}),
        ...(dto.whatsappOptedOut !== undefined
          ? { whatsappOptedOut: dto.whatsappOptedOut }
          : {}),
      },
    });

    const contact = await this.prisma.contact.findFirstOrThrow({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: contactSelect,
    });
    return {
      contact: (await this.withScores(businessId, [contact]))[0],
      warnings: this.duplicateWarnings(duplicate, actor),
    };
  }

  async remove(businessId: string, actor: JwtPayload, contactId: string) {
    const result = await this.prisma.contact.updateMany({
      where: {
        id: contactId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException("Contact not found");
    return { success: true };
  }

  private async findDuplicate(
    businessId: string,
    normalizedPhone: string,
    excludeId?: string,
  ) {
    return this.prisma.contact.findFirst({
      where: {
        businessId,
        normalizedPhone,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, phone: true, assignedToId: true },
    });
  }

  private duplicateWarnings(
    duplicate: {
      id: string;
      name: string;
      phone: string;
      assignedToId: string;
    } | null,
    actor: JwtPayload,
  ): ContactDuplicateWarning[] {
    if (!duplicate) return [];
    return [
      {
        code: "DUPLICATE_PHONE",
        message:
          "Another active contact in this business uses this phone number.",
        contact:
          actor.role === "STAFF" && duplicate.assignedToId !== actor.sub
            ? null
            : {
                id: duplicate.id,
                name: duplicate.name,
                phone: duplicate.phone,
              },
      },
    ];
  }

  private normalizeTags(tags?: string[]): string[] {
    return [
      ...new Set(
        (tags ?? [])
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    ];
  }

  private assignmentScope(actor: JwtPayload): Prisma.ContactWhereInput {
    return actor.role === "STAFF" ? { assignedToId: actor.sub } : {};
  }

  private async assertAssignableUser(businessId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        businessId,
        role: { in: ["SUPER_ADMIN", "OWNER", "STAFF"] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user)
      throw new ForbiddenException("Contact assignee is not available");
  }

  private async withScores(businessId: string, contacts: ContactRecord[]) {
    const scores = await this.calculateScores(businessId, contacts.map((contact) => contact.id));
    return contacts.map((contact) => this.toResponse(contact, scores.get(contact.id) ?? 0));
  }

  private async calculateScores(businessId: string, contactIds: string[]) {
    if (!contactIds.length) return new Map<string, number>();
    const [conversations, deals] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { businessId, contactId: { in: contactIds }, deletedAt: null },
        select: { contactId: true, messages: { select: { direction: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
      }),
      this.prisma.deal.groupBy({
        by: ["contactId"],
        where: { businessId, contactId: { in: contactIds }, deletedAt: null },
        _sum: { value: true },
      }),
    ]);
    const result = new Map<string, number>();
    for (const contactId of contactIds) {
      const messages = conversations.filter((conversation) => conversation.contactId === contactId).flatMap((conversation) => conversation.messages);
      const responseTimes: number[] = [];
      for (let index = 0; index < messages.length; index += 1) {
        if (messages[index]?.direction !== "INBOUND") continue;
        const reply = messages.slice(index + 1).find((message) => message.direction === "OUTBOUND");
        if (reply) responseTimes.push(reply.createdAt.getTime() - messages[index].createdAt.getTime());
      }
      const averageResponse = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : Number.POSITIVE_INFINITY;
      const dealValue = Number(deals.find((deal) => deal.contactId === contactId)?._sum.value ?? 0);
      const messagePoints = Math.min(30, messages.length * 2);
      const responsePoints = averageResponse < 15 * 60_000 ? 30 : averageResponse < 60 * 60_000 ? 20 : averageResponse < 24 * 60 * 60_000 ? 10 : 0;
      const dealPoints = dealValue >= 100_000 ? 40 : dealValue >= 50_000 ? 30 : dealValue >= 10_000 ? 20 : dealValue > 0 ? 10 : 0;
      result.set(contactId, Math.min(100, messagePoints + responsePoints + dealPoints));
    }
    return result;
  }

  private toResponse(contact: ContactRecord, leadScore: number) {
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      source: sourceFromPrisma[contact.source],
      tags: contact.tags,
      customFields: contact.customFields as Record<string, unknown>,
      assignedTo: contact.assignedTo,
      creditTermsDays: contact.creditTermsDays,
      gstin: contact.gstin,
      billingStateCode: contact.billingStateCode,
      whatsappOptedOut: contact.whatsappOptedOut,
      leadScore,
      createdBy: contact.createdBy,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }
}
