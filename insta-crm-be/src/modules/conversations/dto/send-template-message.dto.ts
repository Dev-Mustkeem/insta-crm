import { IsArray, IsString, Matches, MaxLength } from "class-validator";

export class SendTemplateMessageDto {
  @IsString()
  @MaxLength(512)
  @Matches(/^[a-z0-9_]+$/)
  name!: string;

  @IsString()
  @Matches(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)
  language!: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  parameters!: string[];
}
