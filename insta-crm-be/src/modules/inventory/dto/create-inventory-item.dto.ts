import { IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  @Length(1, 60)
  sku!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999)
  openingQuantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  sellingPrice?: number;
}
