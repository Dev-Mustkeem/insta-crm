import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, Length, MaxLength } from "class-validator";

const splitAddresses = ({ value }: { value?: string | string[] }) =>
  (Array.isArray(value) ? value : (value ?? "").split(/[;,]/))
    .map((address) => address.trim())
    .filter(Boolean);

export class SendTextMessageDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 4096)
  body!: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim() || undefined)
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @Transform(splitAddresses)
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  to?: string[];

  @IsOptional()
  @Transform(splitAddresses)
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @Transform(splitAddresses)
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  bcc?: string[];
}
