import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { SupportTicketStatus } from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListSupportTicketsQueryDto {
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

  @ApiPropertyOptional({ example: SupportTicketStatus.RECEIVED, enum: SupportTicketStatus })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiPropertyOptional({ example: "DEPOSIT_WITHDRAWAL" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: "trader@gnndex.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "출금" })
  @IsOptional()
  @IsString()
  subject?: string;

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
