import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateCoinListingDto {
  @ApiPropertyOptional({ example: "INTERNAL", enum: ["BINANCE", "INTERNAL"] })
  @IsOptional()
  @IsIn(["BINANCE", "INTERNAL"])
  chartSource?: "BINANCE" | "INTERNAL";

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 10, minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  displayOrder?: number;
}
