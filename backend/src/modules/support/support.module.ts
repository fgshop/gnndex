import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [DatabaseModule, AuditModule, JwtModule.register({})],
  controllers: [SupportController],
  providers: [SupportService, JwtAuthGuard]
})
export class SupportModule {}
