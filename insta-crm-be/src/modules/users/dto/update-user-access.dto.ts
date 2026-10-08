import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, ValidateNested } from "class-validator";
import type { UserRole } from "@insta-crm/shared-types";
import { PagePermissionDto } from "./page-permission.dto";

const MANAGED_ROLES = ["OWNER", "STAFF", "ACCOUNTANT"] as const;

/** Request payload for changing a user's role, status, or page permissions. */
export class UpdateUserAccessDto {
  @IsOptional()
  @IsIn(MANAGED_ROLES)
  role?: Exclude<UserRole, "SUPER_ADMIN">;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => PagePermissionDto)
  permissions?: PagePermissionDto[];
}
