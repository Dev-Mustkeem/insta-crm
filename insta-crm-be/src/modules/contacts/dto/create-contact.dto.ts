import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  IsUUID,
  ValidateIf,
} from "class-validator";
import { CONTACT_SOURCES, type ContactSource } from "@insta-crm/shared-types";

export class CreateContactDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(7, 20)
  @Matches(/^[+()\-\s0-9]+$/, {
    message: "phone must contain only digits and common phone symbols",
  })
  phone!: string;

  @Transform(({ value }: { value?: string }) => {
    const email = value?.trim().toLowerCase();
    return email || undefined;
  })
  @ValidateIf((contact: CreateContactDto) => contact.email !== undefined || contact.source === "gmail")
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsIn(CONTACT_SOURCES)
  source?: ContactSource;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  creditTermsDays = 30;

  @IsOptional()
  @Transform(
    ({ value }: { value?: string }) => value?.trim().toUpperCase() || undefined,
  )
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  gstin?: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim() || undefined)
  @Matches(/^[0-9]{2}$/)
  billingStateCode?: string;
}
