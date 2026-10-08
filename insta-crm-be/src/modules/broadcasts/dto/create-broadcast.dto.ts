import { IsArray, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateBroadcastDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  templateName!: string;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)
  templateLanguage!: string;

  @IsArray()
  @IsString({ each: true })
  parameters!: string[];

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  source?: string;
}