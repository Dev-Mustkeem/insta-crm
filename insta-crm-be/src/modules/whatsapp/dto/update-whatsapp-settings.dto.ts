import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateWhatsAppSettingsDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 100)
  phoneNumberId!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(8, 30)
  displayPhoneNumber!: string;

  @IsOptional()
  @IsString()
  @Length(16, 500)
  apiKey?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/)
  reminderTemplateName?: string | null;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)
  reminderTemplateLanguage!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/)
  digestTemplateName?: string | null;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)
  digestTemplateLanguage!: string;

  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;
}
