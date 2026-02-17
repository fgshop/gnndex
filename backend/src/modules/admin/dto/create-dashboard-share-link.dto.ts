import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const DASHBOARD_PRESET_SLOT_VALUES = ["default", "risk-watch", "compliance"] as const;

export class CreateDashboardShareLinkDto {
  @ApiPropertyOptional({
    example: "NEW",
    description: "Order status substring filter"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderStatus?: string;

  @ApiPropertyOptional({
    example: "BTC-USDT",
    description: "Order symbol substring filter"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderSymbol?: string;

  @ApiPropertyOptional({
    example: "APPROVED",
    description: "Withdrawal status substring filter"
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  withdrawalStatus?: string;

  @ApiPropertyOptional({
    example: "ADMIN_PERMISSIONS_UPDATED",
    description: "Audit action substring filter"
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  auditAction?: string;

  @ApiPropertyOptional({
    enum: DASHBOARD_PRESET_SLOT_VALUES,
    example: "risk-watch",
    description: "Dashboard preset slot"
  })
  @IsOptional()
  @IsIn(DASHBOARD_PRESET_SLOT_VALUES)
  presetSlot?: (typeof DASHBOARD_PRESET_SLOT_VALUES)[number];

  @ApiPropertyOptional({
    example: 1440,
    description: "Link validity in minutes (min 5, max 10080)"
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(10080)
  expiresInMinutes?: number;
}
