import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { ConversationsService } from "./conversations.service";
import { AssignConversationDto } from "./dto/assign-conversation.dto";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { CreateNoteDto } from "./dto/create-note.dto";
import { ListConversationsQueryDto } from "./dto/list-conversations-query.dto";
import { SendTemplateMessageDto } from "./dto/send-template-message.dto";
import { SendTextMessageDto } from "./dto/send-text-message.dto";

@Controller("conversations")
@PageAccess("EMAIL")
@Roles("OWNER", "STAFF")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get("options")
  options(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversations.options(businessId, user);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversations.create(businessId, user, dto);
  }

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversations.list(businessId, user, query);
  }

  @Get(":id")
  thread(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.thread(businessId, user, conversationId);
  }

  @Post(":id/messages")
  sendText(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Body() dto: SendTextMessageDto,
  ) {
    return this.conversations.sendText(
      businessId,
      user,
      conversationId,
      dto.body,
      dto.subject,
      dto.to,
      dto.cc,
      dto.bcc,
    );
  }

  @Get(":id/suggestions")
  suggestions(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.suggestions(businessId, user, conversationId);
  }

  @Post(":id/templates")
  sendTemplate(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Body() dto: SendTemplateMessageDto,
  ) {
    return this.conversations.sendTemplate(
      businessId,
      user,
      conversationId,
      dto,
    );
  }

  @Patch(":id/assignment")
  @Roles("OWNER")
  assign(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.conversations.assign(businessId, user, conversationId, dto);
  }

  @Post(":id/read")
  markRead(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.markRead(businessId, user, conversationId);
  }

  @Post(":id/notes")
  addNote(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.conversations.addNote(businessId, user, conversationId, dto);
  }
}
