import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { SupportTicketStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListMySupportTicketsQueryDto {
  @ApiPropertyOptional({ example: 20, description: "Row count (max 100)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: SupportTicketStatus, example: SupportTicketStatus.RECEIVED })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;
}
