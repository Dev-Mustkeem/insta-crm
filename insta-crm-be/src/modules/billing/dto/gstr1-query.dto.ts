import { IsDateString, IsOptional } from "class-validator";

export class Gstr1QueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
