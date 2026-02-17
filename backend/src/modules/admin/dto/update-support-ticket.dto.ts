import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SupportTicketStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({
    example: SupportTicketStatus.IN_REVIEW,
    enum: SupportTicketStatus
  })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiProperty({
    example: "출금 트랜잭션 재조회 후 txHash가 생성되면 다시 안내드리겠습니다."
  })
  @IsString()
  @MaxLength(5000)
  adminReply!: string;
}
