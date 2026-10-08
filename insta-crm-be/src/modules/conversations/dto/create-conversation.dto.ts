import { IsIn, IsUUID } from "class-validator";

export class CreateConversationDto {
  @IsUUID()
  contactId!: string;

  @IsIn(["whatsapp", "sms", "email"])
  channel!: "whatsapp" | "sms" | "email";
}
