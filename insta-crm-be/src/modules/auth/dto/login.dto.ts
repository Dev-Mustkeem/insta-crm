import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  password!: string;
}
