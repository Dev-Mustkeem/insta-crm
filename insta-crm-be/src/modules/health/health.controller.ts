import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: "ok",
      service: "insta-crm-be",
      timestamp: new Date().toISOString(),
    };
  }
}
