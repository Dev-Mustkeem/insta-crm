import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class SignupDto {
  @IsString()
  @Length(2, 100)
  businessName!: string;

  @IsString()
  @Length(2, 100)
  ownerName!: string;

  @Transform(({ value }: { value: string }) => value.trim().toLowerCase())
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(7, 20)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
