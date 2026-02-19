import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateNoticeDto {
  @ApiProperty({ enum: ["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"], default: "NOTICE" })
  @IsOptional()
  @IsIn(["NOTICE", "EVENT", "MAINTENANCE", "UPDATE"])
  category?: "NOTICE" | "EVENT" | "MAINTENANCE" | "UPDATE";

  @ApiProperty({ example: "시스템 점검 안내", maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: "점검으로 인해 일부 서비스가 일시 중단됩니다.", maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary!: string;

  @ApiProperty({ example: "점검 시간: 2026-02-20 02:00 ~ 04:00 (KST)..." })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ description: "Pre-existing translations JSON" })
  @IsOptional()
  @IsObject()
  translations?: Record<string, unknown>;
}
