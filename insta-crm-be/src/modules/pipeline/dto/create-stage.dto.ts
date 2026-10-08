import { Transform } from "class-transformer";
import { IsHexColor, IsIn, IsString, Length } from "class-validator";
import type { PipelineStageCategory } from "@insta-crm/shared-types";

const categories = ["open", "won", "lost"] as const;

export class CreateStageDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsIn(categories)
  category!: PipelineStageCategory;
}
