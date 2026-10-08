import { Transform, Type } from "class-transformer";
import {
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import type { PipelineStageCategory } from "@insta-crm/shared-types";

const categories = ["open", "won", "lost"] as const;

export class UpdateStageDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsIn(categories)
  category?: PipelineStageCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
