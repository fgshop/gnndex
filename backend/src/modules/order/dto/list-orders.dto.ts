import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

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

  @ApiPropertyOptional({
    description: "Multi status filter (query repeat or comma-separated)",
    type: [String],
    example: ["NEW", "PARTIALLY_FILLED"]
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  @IsArray()
  @IsIn(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED"], { each: true })
  statuses?: Array<"NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED">;

  @ApiPropertyOptional({ example: "BUY" })
  @IsOptional()
  @IsIn(["BUY", "SELL"])
  side?: "BUY" | "SELL";

  @ApiPropertyOptional({ example: "LIMIT" })
  @IsOptional()
  @IsIn(["MARKET", "LIMIT", "STOP_LIMIT"])
  type?: "MARKET" | "LIMIT" | "STOP_LIMIT";

  @ApiPropertyOptional({
    example: "2026-02-12T00:00:00.000Z",
    description: "createdAt lower bound (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  fromCreatedAt?: string;

  @ApiPropertyOptional({
    example: "2026-02-12T23:59:59.999Z",
    description: "createdAt upper bound (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  toCreatedAt?: string;

  @ApiPropertyOptional({ example: "CREATED_AT", enum: ["CREATED_AT", "PRICE", "QUANTITY"] })
  @IsOptional()
  @IsIn(["CREATED_AT", "PRICE", "QUANTITY"])
  sortBy?: "CREATED_AT" | "PRICE" | "QUANTITY";

  @ApiPropertyOptional({ example: "DESC", enum: ["ASC", "DESC"] })
  @IsOptional()
  @IsIn(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC";
}
