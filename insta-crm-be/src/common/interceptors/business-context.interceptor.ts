import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import type { AuthenticatedRequest } from "../interfaces/authenticated-request.interface";

@Injectable()
export class BusinessContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.businessId) {
      request.businessId = request.user.businessId;
    }
    return next.handle();
  }
}
