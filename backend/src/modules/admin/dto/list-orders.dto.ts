import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListOrdersQueryDto {
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

  @ApiPropertyOptional({ example: "BTC-USDT" })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ example: "NEW" })
  @IsOptional()
  @IsIn(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED"])
  status?: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";

  @ApiPropertyOptional({ example: "trader@gnndex.com" })
  @IsOptional()
  @IsString()
  email?: string;
}
