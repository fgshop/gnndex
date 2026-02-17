import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateSupportTicketDto {
  @ApiProperty({ example: "DEPOSIT_WITHDRAWAL", description: "Support category key" })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @ApiProperty({ example: "출금이 지연되고 있습니다." })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: "TXID는 아직 발급되지 않았고 REVIEW_PENDING 상태가 2시간 지속됩니다." })
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ example: "trader@gnndex.com" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
