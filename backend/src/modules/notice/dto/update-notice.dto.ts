import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateNoticeDto {
  @ApiPropertyOptional({ enum: ["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"] })
  @IsOptional()
  @IsIn(["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"])
  category?: "NOTICE" | "EVENT" | "MAINTENANCE" | "UPDATE";

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ description: "Translations JSON override" })
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;
}
