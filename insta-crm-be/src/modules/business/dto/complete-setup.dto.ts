import { Type } from "class-transformer";
import { IsIn, IsInt, Max, Min } from "class-validator";

const businessTypes = [
  "retailer",
  "service",
  "distributor",
  "manufacturer",
] as const;

export class CompleteSetupDto {
  @IsIn(businessTypes)
  businessType!: (typeof businessTypes)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  teamSize!: number;
}
