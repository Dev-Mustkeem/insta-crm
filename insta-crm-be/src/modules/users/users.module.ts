import { Module } from "@nestjs/common";
import { GmailModule } from "../gmail/gmail.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [GmailModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
