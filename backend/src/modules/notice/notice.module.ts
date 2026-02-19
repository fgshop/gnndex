import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { NoticeController } from "./notice.controller";
import { NoticeService } from "./notice.service";
import { TranslationService } from "./translation.service";

@Module({
  imports: [DatabaseModule, AuditModule, JwtModule.register({})],
  controllers: [NoticeController],
  providers: [NoticeService, TranslationService, JwtAuthGuard, RolesGuard, PermissionsGuard]
})
export class NoticeModule {}
