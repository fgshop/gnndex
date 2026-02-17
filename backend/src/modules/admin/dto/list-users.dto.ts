import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListUsersQueryDto {
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

  @ApiPropertyOptional({ example: "ACTIVE" })
  @IsOptional()
  @IsIn(["ACTIVE", "LOCKED", "SUSPENDED"])
  status?: "ACTIVE" | "LOCKED" | "SUSPENDED";

  @ApiPropertyOptional({
    example: "2026-02-01T00:00:00.000Z",
    description: "createdAt >= this timestamp (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  fromCreatedAt?: string;

  @ApiPropertyOptional({
    example: "2026-02-12T23:59:59.999Z",
    description: "createdAt <= this timestamp (UTC ISO-8601)"
  })
  @IsOptional()
  @IsDateString()
  toCreatedAt?: string;
}
