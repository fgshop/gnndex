import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateWalletDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  @IsNotEmpty()
  asset!: string;

  @ApiPropertyOptional({ example: "Ethereum", description: "Required for multi-network tokens (e.g. USDT). Ignored for native coins." })
  @IsOptional()
  @IsString()
  network?: string;
}
