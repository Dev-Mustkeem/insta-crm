import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { InvoiceLineItemDto } from "./invoice-line-item.dto";

export class SaveInvoiceDto {
  @IsUUID()
  contactId!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== "")
  @IsUUID()
  dealId?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];

  @IsDateString({ strict: true })
  dueDate!: string;
}
