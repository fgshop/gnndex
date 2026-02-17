import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { TradeSimulationService } from "./trade-simulation.service";

@Module({
  imports: [DatabaseModule, AuditModule, JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, TradeSimulationService, JwtAuthGuard, RolesGuard, PermissionsGuard]
})
export class AdminModule {}
