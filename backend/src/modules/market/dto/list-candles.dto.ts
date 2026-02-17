import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const CANDLE_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export class ListCandlesQueryDto {
  @ApiProperty({ example: "BTC-USDT" })
  @IsString()
  symbol!: string;

  @ApiPropertyOptional({ enum: CANDLE_INTERVALS, example: "1m" })
  @IsOptional()
  @IsIn(CANDLE_INTERVALS)
  interval?: CandleInterval;

  @ApiPropertyOptional({ example: 120, description: "Number of candles (max 500)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

