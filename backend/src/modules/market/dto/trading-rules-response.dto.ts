import { ApiProperty } from "@nestjs/swagger";

export class TradingRulesResponseDto {
  @ApiProperty({ example: "BTC-USDT" })
  symbol!: string;

  @ApiProperty({ example: "BTC" })
  baseAsset!: string;

  @ApiProperty({ example: "USDT" })
  quoteAsset!: string;

  @ApiProperty({ example: "5" })
  minOrderNotional!: string;

  @ApiProperty({ example: "0.02" })
  makerFeeRatePct!: string;

  @ApiProperty({ example: "0.06" })
  takerFeeRatePct!: string;

  @ApiProperty({ example: "10" })
  vatRatePct!: string;

  @ApiProperty({ example: "0.022" })
  makerFeeRatePctInclVat!: string;

  @ApiProperty({ example: "0.066" })
  takerFeeRatePctInclVat!: string;
}
