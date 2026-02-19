import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListDepositsQueryDto {
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

  @ApiPropertyOptional({ description: "createdAt lower bound (UTC ISO-8601)" })
  @IsOptional()
  @IsString()
  fromCreatedAt?: string;

  @ApiPropertyOptional({ description: "createdAt upper bound (UTC ISO-8601)" })
  @IsOptional()
  @IsString()
  toCreatedAt?: string;
}
