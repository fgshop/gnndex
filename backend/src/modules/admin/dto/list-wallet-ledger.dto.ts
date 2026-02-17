import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListWalletLedgerQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: "trader@gnndex.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "USDT" })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    example: "ADJUSTMENT",
    enum: [
      "DEPOSIT",
      "WITHDRAWAL",
      "ORDER_LOCK",
      "ORDER_UNLOCK",
      "TRADE_SETTLEMENT",
      "ADJUSTMENT"
    ]
  })
  @IsOptional()
  @IsIn([
    "DEPOSIT",
    "WITHDRAWAL",
    "ORDER_LOCK",
    "ORDER_UNLOCK",
    "TRADE_SETTLEMENT",
    "ADJUSTMENT"
  ])
  entryType?:
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "ORDER_LOCK"
    | "ORDER_UNLOCK"
    | "TRADE_SETTLEMENT"
    | "ADJUSTMENT";
}
