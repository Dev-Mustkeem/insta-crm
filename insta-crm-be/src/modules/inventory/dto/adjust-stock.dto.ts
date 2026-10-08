import { IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class AdjustStockDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(-999999999)
  @Max(999999999)
  quantityDelta!: number;

  @IsOptional()
  @IsString()
  @Length(1, 240)
  reason?: string;
}
