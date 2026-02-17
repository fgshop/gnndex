import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListWithdrawalsQueryDto {
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

  @ApiPropertyOptional({ example: "ETH-ERC20" })
  @IsOptional()
  @IsString()
  network?: string;

  @ApiPropertyOptional({
    example: "REVIEW_PENDING",
    enum: [
      "REQUESTED",
      "REVIEW_PENDING",
      "APPROVED",
      "REJECTED",
      "BROADCASTED",
      "CONFIRMED",
      "FAILED"
    ]
  })
  @IsOptional()
  @IsIn([
    "REQUESTED",
    "REVIEW_PENDING",
    "APPROVED",
    "REJECTED",
    "BROADCASTED",
    "CONFIRMED",
    "FAILED"
  ])
  status?:
    | "REQUESTED"
    | "REVIEW_PENDING"
    | "APPROVED"
    | "REJECTED"
    | "BROADCASTED"
    | "CONFIRMED"
    | "FAILED";

  @ApiPropertyOptional({
    example: "2026-02-01T00:00:00.000Z",
    description: "Requested at >= this timestamp (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  fromRequestedAt?: string;

  @ApiPropertyOptional({
    example: "2026-02-12T23:59:59.999Z",
    description: "Requested at <= this timestamp (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  toRequestedAt?: string;
}
