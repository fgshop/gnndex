import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Matches } from "class-validator";

const SIGNED_DECIMAL_REGEX = /^-?\d+(\.\d+)?$/;

export class AdjustBalanceDto {
  @ApiProperty({ example: "trader@gnndex.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "USDT" })
  @IsString()
  asset!: string;

  @ApiProperty({ example: "250.50", description: "Signed decimal string" })
  @IsString()
  @Matches(SIGNED_DECIMAL_REGEX)
  amount!: string;

  @ApiProperty({ example: "manual treasury adjustment", required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
