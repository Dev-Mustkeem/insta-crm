import { Transform, Type } from "class-transformer";
import { IsBoolean, IsOptional, Matches } from "class-validator";

export class UpdateBillingSettingsDto {
  @Type(() => Boolean)
  @IsBoolean()
  eInvoiceApplicable!: boolean;

  @IsOptional()
  @Transform(
    ({ value }: { value?: string }) => value?.trim().toUpperCase() || undefined,
  )
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  gstin?: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim() || undefined)
  @Matches(/^[0-9]{2}$/)
  stateCode?: string;
}
