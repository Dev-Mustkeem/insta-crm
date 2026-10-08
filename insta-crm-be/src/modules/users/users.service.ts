import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AccessLevel, AppPage, Prisma, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { APPLICATION_PAGES, DEFAULT_ROLE_PERMISSIONS, resolvePagePermissions } from "../../common/permissions/page-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { SystemEmailService } from "../gmail/system-email.service";
import type { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import type { InviteUserDto } from "./dto/invite-user.dto";
import type { PagePermissionDto } from "./dto/page-permission.dto";
import type { UpdateUserAccessDto } from "./dto/update-user-access.dto";

const INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemEmail: SystemEmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Lists users and invitations belonging to one organization.
   *
   * @param businessId - Organization identifier from the authenticated session.
   * @returns Organization users and invitation summaries.
   */
  async list(businessId: string) {
    const [users, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { businessId },
        include: { pagePermissions: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.organizationInvitation.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: !user.deletedAt,
        permissions: resolvePagePermissions(user.role, user.pagePermissions),
        createdAt: user.createdAt.toISOString(),
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        permissions: this.readPermissions(invitation.permissions, invitation.role),
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Creates an invitation and emails its one-time acceptance link.
   *
   * @param businessId - Organization identifier.
   * @param inviterId - Super-admin creating the invitation.
   * @param dto - Invitation role and page access.
   * @returns The created invitation summary.
   * @throws ConflictException When the email already belongs to a user.
   */
  async invite(businessId: string, inviterId: string, dto: InviteUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true },
    });
    const permissions = this.normalizePermissions(dto.permissions, dto.role as Role);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

    await this.prisma.organizationInvitation.deleteMany({
      where: { businessId, email: dto.email, acceptedAt: null },
    });
    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        businessId,
        email: dto.email,
        role: dto.role,
        permissions,
        tokenHash,
        invitedById: inviterId,
        expiresAt,
      },
    });

    const webOrigin = this.config.get<string>("WEB_ORIGIN", "http://localhost:3000").split(",")[0].trim();
    const link = `${webOrigin.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
    try {
      await this.systemEmail.send(
        dto.email,
        `Invitation to join ${business.name}`,
        [
          `You have been invited to join ${business.name} on Insta ICT Solutions CRM.`,
          "",
          `Accept your invitation: ${link}`,
          "",
          "This secure link expires in 48 hours and can be used once.",
        ].join("\n"),
      );
    } catch (error) {
      await this.prisma.organizationInvitation.delete({ where: { id: invitation.id } });
      throw error;
    }
    return { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt.toISOString() };
  }

  /**
   * Reads public invitation details needed by the acceptance screen.
   *
   * @param token - Raw one-time invitation token.
   * @returns Organization and invitation identity details.
   * @throws NotFoundException When the token is invalid or no longer usable.
   */
  async invitationDetails(token: string) {
    const invitation = await this.findUsableInvitation(token);
    return {
      organizationName: invitation.business.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Creates an organization account from a valid invitation.
   *
   * @param dto - Acceptance token and new user's profile credentials.
   * @returns A success indicator.
   * @throws ConflictException When the email was registered before acceptance.
   */
  async accept(dto: AcceptInvitationDto) {
    const invitation = await this.findUsableInvitation(dto.token);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const permissions = this.readPermissions(invitation.permissions, invitation.role);
    try {
      await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            businessId: invitation.businessId,
            email: invitation.email,
            name: dto.name,
            phone: dto.phone,
            passwordHash,
            role: invitation.role,
          },
        });
        await transaction.userPagePermission.createMany({
          data: permissions.map((permission) => ({
            userId: user.id,
            businessId: invitation.businessId,
            page: permission.page,
            access: permission.access,
          })),
        });
        const accepted = await transaction.organizationInvitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
          data: { acceptedAt: new Date() },
        });
        if (accepted.count !== 1) throw new BadRequestException("Invitation is no longer valid");
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
    return { success: true };
  }

  /**
   * Updates a managed user's role, active status, and permission matrix.
   *
   * @param businessId - Organization identifier.
   * @param actorId - Super-admin performing the update.
   * @param userId - Target organization user.
   * @param dto - Requested access changes.
   * @returns A success indicator.
   * @throws ForbiddenException When attempting to change a super-admin or self-deactivate.
   */
  async update(businessId: string, actorId: string, userId: string, dto: UpdateUserAccessDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, businessId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.role === "SUPER_ADMIN") throw new ForbiddenException("The organization super admin cannot be modified");
    if (actorId === userId && dto.active === false) throw new ForbiddenException("You cannot deactivate your own account");

    const role = (dto.role ?? user.role) as Role;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: userId },
        data: {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.active === undefined ? {} : { deletedAt: dto.active ? null : new Date() }),
          ...(dto.active === false ? { refreshTokenHash: null } : {}),
        },
      });
      if (dto.permissions) {
        const permissions = this.normalizePermissions(dto.permissions, role);
        await transaction.userPagePermission.deleteMany({ where: { userId } });
        await transaction.userPagePermission.createMany({
          data: permissions.map((permission) => ({
            userId,
            businessId,
            page: permission.page,
            access: permission.access,
          })),
        });
      }
    });
    return { success: true };
  }

  /** Resolves and validates a raw invitation token. */
  private async findUsableInvitation(token: string) {
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) throw new NotFoundException("Invitation not found");
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { business: { select: { name: true, deletedAt: true } } },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || invitation.business.deletedAt) {
      throw new NotFoundException("Invitation is invalid or has expired");
    }
    return invitation;
  }

  /** Produces a complete, duplicate-free page permission matrix. */
  private normalizePermissions(permissions: PagePermissionDto[], role: Role) {
    const supplied = new Map<AppPage, AccessLevel>();
    for (const permission of permissions) supplied.set(permission.page as AppPage, permission.access as AccessLevel);
    return APPLICATION_PAGES.map((page) => ({
      page,
      access: supplied.get(page) ?? DEFAULT_ROLE_PERMISSIONS[role][page],
    }));
  }

  /** Safely decodes a permission snapshot stored on an invitation. */
  private readPermissions(value: Prisma.JsonValue, role: Role) {
    if (!Array.isArray(value)) return this.normalizePermissions([], role);
    const valid = value.filter((item): item is { page: AppPage; access: AccessLevel } => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const candidate = item as Record<string, unknown>;
      return APPLICATION_PAGES.includes(candidate.page as AppPage) && ["NONE", "READ", "WRITE"].includes(candidate.access as string);
    });
    return this.normalizePermissions(valid, role);
  }

  /** Hashes a raw invitation token for storage and lookup. */
  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Identifies Prisma unique-constraint failures without exposing database details. */
  private isUniqueConstraintError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
  }
}
