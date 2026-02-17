import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DatabaseModule } from "../database/database.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [OrderController],
  providers: [OrderService, JwtAuthGuard]
})
export class OrderModule {}
