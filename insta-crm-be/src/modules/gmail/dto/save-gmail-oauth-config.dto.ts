import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUrl, Length, MaxLength } from "class-validator";

export class SaveGmailOAuthConfigDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(10, 300)
  clientId!: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim() || undefined)
  @IsString()
  @Length(10, 500)
  clientSecret?: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ["http", "https"] })
  redirectUri!: string;
}
