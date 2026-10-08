import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentBusiness } from "../../common/decorators/current-business.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PageAccess } from "../../common/decorators/page-access.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { JwtPayload } from "../../common/interfaces/authenticated-request.interface";
import { BillingService } from "./billing.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { Gstr1QueryDto } from "./dto/gstr1-query.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { SaveInvoiceDto } from "./dto/save-invoice.dto";
import { UpdateBillingSettingsDto } from "./dto/update-billing-settings.dto";

@Controller("billing")
@PageAccess("BILLING")
@Roles("OWNER", "ACCOUNTANT")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("settings")
  settings(@CurrentBusiness() businessId: string) {
    return this.billing.settings(businessId);
  }

  @Patch("settings")
  @Roles("OWNER")
  updateSettings(
    @CurrentBusiness() businessId: string,
    @Body() dto: UpdateBillingSettingsDto,
  ) {
    return this.billing.updateSettings(businessId, dto);
  }

  @Get("options")
  options(@CurrentBusiness() businessId: string) {
    return this.billing.options(businessId);
  }

  @Get("prefill")
  prefill(
    @CurrentBusiness() businessId: string,
    @Query("dealId", ParseUUIDPipe) dealId: string,
  ) {
    return this.billing.prefill(businessId, dealId);
  }

  @Get("aging")
  aging(@CurrentBusiness() businessId: string) {
    return this.billing.aging(businessId);
  }

  @Get("receivables/customers")
  customerReceivables(@CurrentBusiness() businessId: string) {
    return this.billing.customerReceivables(businessId);
  }

  @Get("gstr1.csv")
  async gstr1(
    @CurrentBusiness() businessId: string,
    @Query() query: Gstr1QueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.billing.gstr1(businessId, query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    response.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(Buffer.from(file.csv, "utf8"));
  }

  @Post("invoices")
  create(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveInvoiceDto,
  ) {
    return this.billing.create(businessId, user.sub, dto);
  }

  @Get("invoices")
  list(
    @CurrentBusiness() businessId: string,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.billing.list(businessId, query);
  }

  @Get("invoices/:id/pdf")
  async pdf(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.billing.pdf(businessId, invoiceId);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="' +
        file.filename.replace(/[^a-zA-Z0-9_.-]/g, "-") +
        '"',
    );
    response.setHeader("Cache-Control", "private, no-store");
    return new StreamableFile(file.buffer);
  }

  @Get("invoices/:id")
  findOne(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.findOne(businessId, invoiceId);
  }

  @Put("invoices/:id")
  replace(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
    @Body() dto: SaveInvoiceDto,
  ) {
    return this.billing.replace(businessId, invoiceId, dto);
  }

  @Post("invoices/:id/issue")
  issue(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.issue(businessId, user.sub, invoiceId);
  }

  @Post("invoices/:id/payments")
  addPayment(
    @CurrentBusiness() businessId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) invoiceId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.billing.addPayment(businessId, user.sub, invoiceId, dto);
  }

  @Delete("invoices/:id")
  remove(
    @CurrentBusiness() businessId: string,
    @Param("id", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.remove(businessId, invoiceId);
  }
}
