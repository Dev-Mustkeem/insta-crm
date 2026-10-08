import { SetMetadata } from "@nestjs/common";
import type { AppPage } from "@prisma/client";

export const PAGE_ACCESS_KEY = "pageAccess";

/**
 * Declares the application page whose permission controls a route.
 *
 * @param page - Application page associated with the route.
 * @returns NestJS metadata decorator.
 */
export const PageAccess = (page: AppPage) => SetMetadata(PAGE_ACCESS_KEY, page);
