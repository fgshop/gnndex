import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { DashboardOverviewQueryDto } from "./dashboard-overview.dto";

export class StreamDashboardOverviewQueryDto extends DashboardOverviewQueryDto {
  @ApiPropertyOptional({
    example: 5000,
    description: "SSE emit interval in milliseconds (min 1000, max 60000)"
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(60000)
  intervalMs?: number;
}

