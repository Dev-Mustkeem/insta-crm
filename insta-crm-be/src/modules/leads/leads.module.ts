import { Module } from "@nestjs/common";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { NeonStorageService } from "../storage/neon-storage.service";

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, NeonStorageService],
})
export class LeadsModule {}
