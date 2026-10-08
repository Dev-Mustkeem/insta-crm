import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, Matches } from "class-validator";

export class SaveSmtpConfigDto {
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  @IsEmail()
  senderEmail!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 253)
  @Matches(/^[a-zA-Z0-9.-]+$/)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsIn(["SSL_TLS", "STARTTLS"])
  security!: "SSL_TLS" | "STARTTLS";

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 320)
  username!: string;

  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim() || undefined)
  @IsString()
  @Length(1, 1000)
  password?: string;
}
