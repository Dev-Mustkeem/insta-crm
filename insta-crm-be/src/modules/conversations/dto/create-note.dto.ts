import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class CreateNoteDto {
  @Transform(({ value }: { value: string }) => value.trim())
  @IsString()
  @Length(1, 4000)
  body!: string;
}
