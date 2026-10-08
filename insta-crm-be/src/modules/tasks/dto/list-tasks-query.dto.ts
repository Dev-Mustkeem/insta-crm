import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import type { TaskRelatedEntityType, TaskStatus } from "@insta-crm/shared-types";

const relatedEntityTypes = ["contact", "deal", "invoice"] as const;
const taskStatuses = ["pending", "done", "overdue"] as const;

export class ListTasksQueryDto {
  @IsOptional()
  @IsIn(relatedEntityTypes)
  relatedEntityType?: TaskRelatedEntityType;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string;

  @IsOptional()
  @IsIn(taskStatuses)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 200;
}
