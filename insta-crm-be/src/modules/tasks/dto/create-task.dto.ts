import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import type { TaskRelatedEntityType } from "@insta-crm/shared-types";

const relatedEntityTypes = ["contact", "deal", "invoice"] as const;

export class CreateTaskDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 160)
  title!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsIn(relatedEntityTypes)
  relatedEntityType!: TaskRelatedEntityType;

  @IsUUID()
  relatedEntityId!: string;
}
