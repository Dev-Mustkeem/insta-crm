import { Transform, Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateDealDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 120)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  value!: number;

  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;
}
