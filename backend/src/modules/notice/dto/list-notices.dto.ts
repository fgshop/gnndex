import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListNoticesQueryDto {
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

  @ApiPropertyOptional({ enum: ["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"] })
  @IsOptional()
  @IsIn(["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"])
  category?: "NOTICE" | "EVENT" | "MAINTENANCE" | "UPDATE";

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: "createdAt lower bound (UTC ISO-8601)" })
  @IsOptional()
  @IsString()
  fromCreatedAt?: string;

  @ApiPropertyOptional({ description: "createdAt upper bound (UTC ISO-8601)" })
  @IsOptional()
  @IsString()
  toCreatedAt?: string;
}

export class ListPublicNoticesQueryDto {
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

  @ApiPropertyOptional({ enum: ["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"] })
  @IsOptional()
  @IsIn(["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"])
  category?: "NOTICE" | "EVENT" | "MAINTENANCE" | "UPDATE";

  @ApiPropertyOptional({ example: "en", description: "Locale for translated content" })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class GetPublicNoticeQueryDto {
  @ApiPropertyOptional({ example: "en", description: "Locale for translated content" })
  @IsOptional()
  @IsString()
  locale?: string;
}
