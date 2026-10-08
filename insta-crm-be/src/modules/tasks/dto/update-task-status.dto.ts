import { IsIn } from "class-validator";

export class UpdateTaskStatusDto {
  @IsIn(["pending", "done"])
  status!: "pending" | "done";
}
