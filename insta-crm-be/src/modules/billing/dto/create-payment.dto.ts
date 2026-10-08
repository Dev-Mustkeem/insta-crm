import { Type } from "class-transformer";
import { IsDateString, IsIn, IsNumber, Max, Min } from "class-validator";

export class CreatePaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999999.99)
  amount!: number;

  @IsIn(["cash", "upi", "bank-transfer", "card", "cheque", "other"])
  method!: "cash" | "upi" | "bank-transfer" | "card" | "cheque" | "other";

  @IsDateString()
  paidAt!: string;
}
