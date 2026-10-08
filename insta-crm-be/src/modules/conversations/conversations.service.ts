import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ConversationChannel,
  MessageDirection as PrismaMessageDirection,
  MessageStatus as PrismaMessageStatus,
  Prisma,
} from "@prisma/client";
import type {
  ConversationChannel as SharedConversationChannel,
  ConversationMessage,
  ConversationNote,
  ConversationSummary,
  ConversationThreadResponse,
  MessageDirection,
  MessageStatus,
} from "@insta-crm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { ChannelsService } from "../channels/channels.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { SmtpService } from "../gmail/smtp.service";
import type { AssignConversationDto } from "./dto/assign-conversation.dto";
import type { CreateConversationDto } from "./dto/create-conversation.dto";
import type { CreateNoteDto } from "./dto/create-note.dto";
import type { ListConversationsQueryDto } from "./dto/list-conversations-query.dto";
import type { SendTemplateMessageDto } from "./dto/send-template-message.dto";

const conversationSelect = {
  id: true,
  channel: true,
  lastMessageAt: true,
  unreadCount: true,
  updatedAt: true,
  contact: { select: { id: true, name: true, phone: true, email: true } },
  assignedTo: { select: { id: true, name: true } },
  messages: {
    select: {
      body: true,
      direction: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.ConversationSelect;

const messageSelect = {
  id: true,
  direction: true,
  body: true,
  subject: true,
  status: true,
  externalMessageId: true,
  createdAt: true,
  deliveredAt: true,
  readAt: true,
  failedAt: true,
  sentBy: { select: { id: true, name: true } },
} satisfies Prisma.MessageSelect;

const noteSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.ConversationNoteSelect;

type ConversationRecord = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;
type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type NoteRecord = Prisma.ConversationNoteGetPayload<{
  select: typeof noteSelect;
}>;

const directionFromPrisma: Record<PrismaMessageDirection, MessageDirection> = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
};

const statusFromPrisma: Record<PrismaMessageStatus, MessageStatus> = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
};

const channelFromPrisma: Record<
  ConversationChannel,
  SharedConversationChannel
> = {
  WHATSAPP: "whatsapp",
  SMS: "sms",
  EMAIL: "email",
  CALL: "call",
};

const channelToPrisma: Record<
  CreateConversationDto["channel"],
  ConversationChannel
> = {
  whatsapp: ConversationChannel.WHATSAPP,
  sms: ConversationChannel.SMS,
  email: ConversationChannel.EMAIL,
};

const channelFilterToPrisma: Record<SharedConversationChannel, ConversationChannel> = {
  whatsapp: ConversationChannel.WHATSAPP,
  sms: ConversationChannel.SMS,
  email: ConversationChannel.EMAIL,
  call: ConversationChannel.CALL,
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly channels: ChannelsService,
    private readonly smtp: SmtpService,
  ) {}

  async options(businessId: string, actor: JwtPayload) {
    const [users, contacts] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          businessId,
          deletedAt: null,
          role: { in: ["SUPER_ADMIN", "OWNER", "STAFF"] },
          ...(actor.role === "STAFF" ? { id: actor.sub } : {}),
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.contact.findMany({
        where: {
          businessId,
          deletedAt: null,
          ...this.contactScope(actor),
        },
        select: { id: true, name: true, phone: true, email: true },
        orderBy: { name: "asc" },
        take: 250,
      }),
    ]);
    return { users, contacts, canAssign: ["SUPER_ADMIN", "OWNER"].includes(actor.role) };
  }

  async create(
    businessId: string,
    actor: JwtPayload,
    dto: CreateConversationDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: dto.contactId,
        businessId,
        deletedAt: null,
        ...this.contactScope(actor),
      },
      select: { id: true, email: true, assignedToId: true },
    });
    if (!contact) throw new NotFoundException("Contact not found");
    if (dto.channel === "email" && !contact.email) {
      throw new BadRequestException(
        "Add an email address to this contact first",
      );
    }
    const conversation = await this.prisma.conversation.upsert({
      where: {
        businessId_channel_contactId: {
          businessId,
          channel: channelToPrisma[dto.channel],
          contactId: contact.id,
        },
      },
      create: {
        businessId,
        contactId: contact.id,
        channel: channelToPrisma[dto.channel],
        assignedToId: contact.assignedToId,
      },
      update: { deletedAt: null },
      select: { id: true },
    });
    return this.thread(businessId, actor, conversation.id);
  }

  async list(
    businessId: string,
    actor: JwtPayload,
    query: ListConversationsQueryDto,
  ) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(query.contactId ? { contactId: query.contactId } : {}),
        ...(query.channel ? { channel: channelFilterToPrisma[query.channel] } : {}),
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
        ...this.assignmentScope(actor),
        ...(query.search
          ? {
              contact: {
                is: {
                  OR: [
                    { name: { contains: query.search, mode: "insensitive" } },
                    { phone: { contains: query.search } },
                    { email: { contains: query.search, mode: "insensitive" } },
                  ],
                },
              },
            }
          : {}),
      },
      select: conversationSelect,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: query.limit,
    });
    return conversations.map((conversation) => this.toSummary(conversation));
  }

  async thread(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
  ): Promise<ConversationThreadResponse> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: conversationSelect,
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    const [messages, notes] = await Promise.all([
      this.prisma.message.findMany({
        where: { businessId, conversationId },
        select: messageSelect,
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      this.prisma.conversationNote.findMany({
        where: { businessId, conversationId, deletedAt: null },
        select: noteSelect,
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    ]);
    return {
      conversation: this.toSummary(conversation),
      messages: messages.map((message) => this.toMessage(message)),
      notes: notes.map((note) => this.toNote(note)),
    };
  }

  async sendText(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
    body: string,
    subject?: string,
    to?: string[],
    cc?: string[],
    bcc?: string[],
  ) {
    const conversation = await this.requireConversation(
      businessId,
      actor,
      conversationId,
    );
    let externalMessageId = "";
    if (conversation.channel === ConversationChannel.WHATSAPP) {
      externalMessageId = (
        await this.whatsapp.sendText(
          businessId,
          conversation.contact.phone,
          body,
        )
      ).externalMessageId;
    } else if (conversation.channel === ConversationChannel.SMS) {
      externalMessageId = (
        await this.channels.sendSms(
          businessId,
          conversation.contact.phone,
          body,
        )
      ).externalMessageId;
    } else if (conversation.channel === ConversationChannel.EMAIL) {
      if (!conversation.contact.email && !to?.length) {
        throw new BadRequestException("Add at least one email recipient");
      }
      externalMessageId = (
        await this.smtp.sendEmail(
          businessId,
          conversation.contact.email ?? "",
          subject || "Message from your CRM contact",
          body,
          to?.length ? to : conversation.contact.email ? [conversation.contact.email] : [],
          cc,
          bcc,
        )
      ).externalMessageId;
    } else {
      throw new BadRequestException("Outbound calls are not supported yet");
    }
    return this.recordOutbound(
      businessId,
      actor.sub,
      conversationId,
      body,
      externalMessageId,
      subject || null,
    );
  }

  async suggestions(businessId: string, actor: JwtPayload, conversationId: string) {
    const conversation = await this.requireConversation(businessId, actor, conversationId);
    const latestInbound = await this.prisma.message.findFirst({
      where: { businessId, conversationId, direction: PrismaMessageDirection.INBOUND },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    if (!latestInbound) return { enabled: true, suggestions: [] };
    const body = latestInbound.body.toLowerCase();
    const suggestions = body.includes("price") || body.includes("cost")
      ? ["I will share the latest pricing with you shortly.", "Could you tell me the quantity you need so I can prepare an accurate quote?", "Would you like me to arrange a quick call to discuss this?"]
      : body.includes("thank")
        ? ["You are welcome. Please reach out if you need anything else.", "Happy to help. Shall I keep this requirement open for you?", "Thanks for connecting with us."]
        : ["Thanks for reaching out. I am checking this and will get back to you shortly.", "Could you share a little more about what you need?", "Would a quick call today be convenient?"];
    return { enabled: true, suggestions, basedOn: conversation.id };
  }

  async sendTemplate(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
    dto: SendTemplateMessageDto,
  ) {
    const conversation = await this.requireConversation(
      businessId,
      actor,
      conversationId,
    );
    if (conversation.channel !== ConversationChannel.WHATSAPP) {
      throw new BadRequestException(
        "Templates are only available for WhatsApp",
      );
    }
    const sent = await this.whatsapp.sendTemplate(
      businessId,
      conversation.contact.phone,
      dto.name,
      dto.language,
      dto.parameters,
    );
    const body =
      "Template: " +
      dto.name +
      (dto.parameters.length ? " · " + dto.parameters.join(" · ") : "");
    return this.recordOutbound(
      businessId,
      actor.sub,
      conversationId,
      body,
      sent.externalMessageId,
      null,
    );
  }

  async assign(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
    dto: AssignConversationDto,
  ) {
    await this.requireConversation(businessId, actor, conversationId);
    if (dto.assignedToId) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: dto.assignedToId,
          businessId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!user) throw new BadRequestException("Assignee not found");
    }
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, businessId, deletedAt: null },
      data: { assignedToId: dto.assignedToId || null },
    });
    return this.thread(businessId, actor, conversationId);
  }

  async markRead(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
  ) {
    const result = await this.prisma.conversation.updateMany({
      where: {
        id: conversationId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      data: { unreadCount: 0 },
    });
    if (!result.count) throw new NotFoundException("Conversation not found");
    return { success: true };
  }

  async addNote(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
    dto: CreateNoteDto,
  ) {
    await this.requireConversation(businessId, actor, conversationId);
    const note = await this.prisma.conversationNote.create({
      data: {
        businessId,
        conversationId,
        authorId: actor.sub,
        body: dto.body,
      },
      select: noteSelect,
    });
    return this.toNote(note);
  }

  private async requireConversation(
    businessId: string,
    actor: JwtPayload,
    conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        businessId,
        deletedAt: null,
        ...this.assignmentScope(actor),
      },
      select: {
        id: true,
        channel: true,
        contact: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  private async recordOutbound(
    businessId: string,
    actorId: string,
    conversationId: string,
    body: string,
    externalMessageId: string,
    subject: string | null,
  ): Promise<ConversationMessage> {
    const createdAt = new Date();
    const message = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({
        data: {
          businessId,
          conversationId,
          direction: PrismaMessageDirection.OUTBOUND,
          body,
          subject,
          status: PrismaMessageStatus.SENT,
          externalMessageId,
          sentById: actorId,
          createdAt,
        },
        select: messageSelect,
      });
      await transaction.conversation.updateMany({
        where: { id: conversationId, businessId, deletedAt: null },
        data: { lastMessageAt: createdAt },
      });
      return created;
    });
    return this.toMessage(message);
  }

  private toSummary(conversation: ConversationRecord): ConversationSummary {
    const lastMessage = conversation.messages[0];
    return {
      id: conversation.id,
      channel: channelFromPrisma[conversation.channel],
      contact: conversation.contact,
      assignedTo: conversation.assignedTo,
      lastMessage: lastMessage
        ? {
            body: lastMessage.body,
            direction: directionFromPrisma[lastMessage.direction],
            status: statusFromPrisma[lastMessage.status],
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount: conversation.unreadCount,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toMessage(message: MessageRecord): ConversationMessage {
    return {
      id: message.id,
      direction: directionFromPrisma[message.direction],
      body: message.body,
      subject: message.subject,
      status: statusFromPrisma[message.status],
      externalMessageId: message.externalMessageId,
      sentBy: message.sentBy,
      createdAt: message.createdAt.toISOString(),
      deliveredAt: message.deliveredAt?.toISOString() ?? null,
      readAt: message.readAt?.toISOString() ?? null,
      failedAt: message.failedAt?.toISOString() ?? null,
    };
  }

  private toNote(note: NoteRecord): ConversationNote {
    return {
      id: note.id,
      body: note.body,
      author: note.author,
      createdAt: note.createdAt.toISOString(),
    };
  }

  private assignmentScope(actor: JwtPayload): { assignedToId?: string } {
    return actor.role === "STAFF" ? { assignedToId: actor.sub } : {};
  }

  private contactScope(actor: JwtPayload): { assignedToId?: string } {
    return actor.role === "STAFF" ? { assignedToId: actor.sub } : {};
  }
}
