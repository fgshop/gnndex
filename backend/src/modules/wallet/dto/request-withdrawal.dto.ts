import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

export class RequestWithdrawalDto {
  @ApiProperty({ example: "USDT" })
  @IsString()
  asset!: string;

  @ApiProperty({ example: "ETH-ERC20" })
  @IsString()
  network!: string;

  @ApiProperty({ example: "0x1234567890abcdef1234567890abcdef12345678" })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: "123456" })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiProperty({ example: "120.50" })
  @IsString()
  @Matches(DECIMAL_REGEX)
  amount!: string;

  @ApiPropertyOptional({ example: "0.50" })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_REGEX)
  fee?: string;
}
