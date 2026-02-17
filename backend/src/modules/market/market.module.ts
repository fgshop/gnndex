import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MarketController],
  providers: [MarketService]
})
export class MarketModule {}

