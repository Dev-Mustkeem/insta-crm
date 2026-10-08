import { IsIn } from "class-validator";
import { ACCESS_LEVELS, APP_PAGES, type AccessLevel, type AppPage } from "@insta-crm/shared-types";

/** Validated page-level access assignment. */
export class PagePermissionDto {
  @IsIn(APP_PAGES)
  page!: AppPage;

  @IsIn(ACCESS_LEVELS)
  access!: AccessLevel;
}
