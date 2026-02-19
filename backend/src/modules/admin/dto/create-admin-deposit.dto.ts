import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateAdminDepositDto {
  @ApiProperty({ example: "trader@gnndex.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "USDT" })
  @IsString()
  @IsNotEmpty()
  asset!: string;

  @ApiProperty({ example: "1000.00", description: "Positive decimal amount" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: "amount must be a positive decimal string" })
  amount!: string;

  @ApiPropertyOptional({ example: "Manual deposit for user" })
  @IsOptional()
  @IsString()
  reason?: string;
}
