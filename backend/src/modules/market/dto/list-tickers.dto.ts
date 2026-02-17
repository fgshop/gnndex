import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListTickersQueryDto {
  @ApiPropertyOptional({
    example: "BTC-USDT,ETH-USDT",
    description: "Comma-separated symbols"
  })
  @IsOptional()
  @IsString()
  symbols?: string;

  @ApiPropertyOptional({ example: 20, description: "Symbol count when symbols is omitted" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

