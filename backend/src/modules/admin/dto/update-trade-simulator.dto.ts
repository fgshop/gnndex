import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

const ALLOWED_INTERVALS = [1, 3, 5, 10, 15, 20, 30, 60] as const;

export class UpdateTradeSimulatorDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ["SIMULATION_ONLY", "LIVE_MARKET"], example: "SIMULATION_ONLY" })
  @IsOptional()
  @IsIn(["SIMULATION_ONLY", "LIVE_MARKET"])
  mode?: "SIMULATION_ONLY" | "LIVE_MARKET";

  @ApiPropertyOptional({
    type: "array",
    items: { type: "number", enum: [...ALLOWED_INTERVALS] },
    example: [1, 5, 15, 30]
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(60, { each: true })
  intervalCandidates?: number[];
}
