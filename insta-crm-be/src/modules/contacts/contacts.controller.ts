import {
  Body,
  Controller,
  Delete,
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
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { ListContactsQueryDto } from "./dto/list-contacts-query.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Controller("contacts")
@PageAccess("CONTACTS")
@Roles("OWNER", "STAFF")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get("options")
  options(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.contacts.options(businessId, user);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contacts.create(businessId, user, dto);
  }

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListContactsQueryDto,
  ) {
    return this.contacts.list(businessId, user, query);
  }

  @Get(":id")
  findOne(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) contactId: string,
  ) {
    return this.contacts.findOne(businessId, user, contactId);
  }

  @Patch(":id")
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(businessId, user, contactId, dto);
  }

  @Delete(":id")
  remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) contactId: string,
  ) {
    return this.contacts.remove(businessId, user, contactId);
  }
}
