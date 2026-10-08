import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  AuthenticatedRequest,
  JwtPayload,
} from "../interfaces/authenticated-request.interface";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new UnauthorizedException("User context is missing");
    }
    return request.user;
  },
);
