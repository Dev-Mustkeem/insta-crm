import { Transform } from "class-transformer";
import { IsString, Length, MaxLength, MinLength } from "class-validator";

/** Request payload used to create an account from an invitation. */
export class AcceptInvitationDto {
  @IsString()
  @Length(40, 200)
  token!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(2, 100)
  name!: string;

  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(7, 20)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
