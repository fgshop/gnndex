import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class CreateCoinListingDto {
  @ApiProperty({ example: "SBK-USDT" })
  @IsString()
  @Matches(/^[A-Z0-9]+-(USDT|KRW)$/, {
    message: "symbol must be in BASE-QUOTE format and quote must be USDT or KRW"
  })
  symbol!: string;

  @ApiPropertyOptional({ example: "INTERNAL", enum: ["BINANCE", "INTERNAL"] })
  @IsOptional()
  @IsIn(["BINANCE", "INTERNAL"])
  chartSource?: "BINANCE" | "INTERNAL";

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  displayOrder?: number;
}
