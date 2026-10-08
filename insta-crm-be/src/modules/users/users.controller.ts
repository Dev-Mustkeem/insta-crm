import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateUserAccessDto } from "./dto/update-user-access.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Returns organization users and invitations to the super admin. */
  @Roles("SUPER_ADMIN")
  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.users.list(user.businessId);
  }

  /** Creates and emails an organization invitation. */
  @Roles("SUPER_ADMIN")
  @Post("invitations")
  invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteUserDto) {
    return this.users.invite(user.businessId, user.sub, dto);
  }

  /** Returns non-sensitive details for a valid invitation token. */
  @Public()
  @Get("invitations/details")
  invitationDetails(@Query("token") token: string) {
    return this.users.invitationDetails(token);
  }

  /** Accepts an invitation and creates the invited user's account. */
  @Public()
  @Post("invitations/accept")
  accept(@Body() dto: AcceptInvitationDto) {
    return this.users.accept(dto);
  }

  /** Updates a managed organization's user's access. */
  @Roles("SUPER_ADMIN")
  @Patch(":userId")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("userId") userId: string,
    @Body() dto: UpdateUserAccessDto,
  ) {
    return this.users.update(user.businessId, user.sub, userId, dto);
  }
}
