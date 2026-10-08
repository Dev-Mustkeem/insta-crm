import { IsOptional, IsUUID } from "class-validator";

export class AssignConversationDto {
  @IsOptional()
  @IsUUID()
  assignedToId?: string | null;
}
