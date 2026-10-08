import { Transform, Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from "class-validator";

export class InvoiceLineItemDto {
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 240)
  description!: string;

  @Transform(({ value }: { value: string }) => value.trim().toUpperCase())
  @IsString()
  @Matches(/^[A-Z0-9.-]{2,12}$/)
  hsnSacCode!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(999999)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  rate!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxPercent!: number;
}
