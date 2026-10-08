import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

const optionalTrim = ({ value }: { value?: string }) =>
  value?.trim() || undefined;

export class UpdateChannelSettingsDto {
  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @Length(8, 200)
  smsAuthKey?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(100)
  smsFlowId?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(20)
  smsSenderId?: string;

  @Transform(optionalTrim)
  @IsString()
  @Length(1, 50)
  smsMessageVariable = "message";

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @Length(16, 200)
  smsWebhookToken?: string;

  @IsBoolean()
  smsEnabled = false;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @Length(8, 200)
  resendApiKey?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(100)
  resendFromName?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsEmail()
  resendFromEmail?: string;

  @IsOptional()
  @Transform(
    ({ value }: { value?: string }) => value?.trim().toLowerCase() || undefined,
  )
  @IsEmail()
  resendReceivingAddress?: string;

  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @Length(16, 250)
  resendWebhookSecret?: string;

  @IsBoolean()
  emailEnabled = false;
}
