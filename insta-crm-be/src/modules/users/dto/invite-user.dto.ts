import { Type, Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsIn, MaxLength, ValidateNested } from "class-validator";
import type { UserRole } from "@insta-crm/shared-types";
import { PagePermissionDto } from "./page-permission.dto";

const INVITABLE_ROLES = ["OWNER", "STAFF", "ACCOUNTANT"] as const;

/** Request payload for inviting an organization user. */
export class InviteUserDto {
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(INVITABLE_ROLES)
  role!: Exclude<UserRole, "SUPER_ADMIN">;

  @IsArray()
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => PagePermissionDto)
  permissions!: PagePermissionDto[];
}
