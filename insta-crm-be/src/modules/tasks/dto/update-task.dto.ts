import { Transform } from "class-transformer";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 160)
  title?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}
