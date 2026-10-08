import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("tasks")
@PageAccess("TASKS")
@Roles("OWNER", "STAFF")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get("options")
  options(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasks.options(businessId, user);
  }

  @Get("today")
  today(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasks.today(businessId, user);
  }

  @Post()
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(businessId, user, dto);
  }

  @Get()
  list(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasks.list(businessId, user, query);
  }

  @Patch(":id/status")
  setStatus(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasks.setStatus(businessId, user, taskId, dto.status);
  }

  @Patch(":id")
  update(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(businessId, user, taskId, dto);
  }

  @Delete(":id")
  remove(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) taskId: string,
  ) {
    return this.tasks.remove(businessId, user, taskId);
  }
}
