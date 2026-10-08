import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { CONTACT_SOURCES, type ContactSource } from "@insta-crm/shared-types";

export class ListContactsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(CONTACT_SOURCES)
  source?: ContactSource;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
