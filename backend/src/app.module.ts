import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { DatabaseModule } from "./modules/database/database.module";
import { MarketModule } from "./modules/market/market.module";
import { OrderModule } from "./modules/order/order.module";
import { NoticeModule } from "./modules/notice/notice.module";
import { SupportModule } from "./modules/support/support.module";
import { WalletModule } from "./modules/wallet/wallet.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    WalletModule,
    OrderModule,
    MarketModule,
    AdminModule,
    NoticeModule,
    SupportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
