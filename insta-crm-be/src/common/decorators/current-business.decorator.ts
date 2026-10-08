import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.businessId) {
      throw new UnauthorizedException("Business context is missing");
    }
    return request.businessId;
  },
);
