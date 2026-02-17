import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({ example: 10, description: "Number of latest rows per section" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: "NEW",
    description: "Order status substring filter (case-insensitive, e.g. NEW, FILLED)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderStatus?: string;

  @ApiPropertyOptional({
    example: "BTC-USDT",
    description: "Order symbol substring filter (case-insensitive)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderSymbol?: string;

  @ApiPropertyOptional({
    example: "APPROVED",
    description: "Withdrawal status substring filter (case-insensitive)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  withdrawalStatus?: string;

  @ApiPropertyOptional({
    example: "ADMIN_PERMISSIONS_UPDATED",
    description: "Audit action substring filter (case-insensitive)"
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  auditAction?: string;
}
