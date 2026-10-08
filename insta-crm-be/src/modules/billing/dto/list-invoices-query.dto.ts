import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsIn(["draft", "sent", "paid", "overdue"])
  status?: "draft" | "sent" | "paid" | "overdue";

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}
