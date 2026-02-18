import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

const POSITIVE_DECIMAL_REGEX = /^\d+(\.\d+)?$/;

export class SimulateDepositDto {
  @ApiProperty({ example: "USDT" })
  @IsString()
  asset!: string;

  @ApiProperty({ example: "100.00", description: "Positive decimal amount" })
  @IsString()
  @Matches(POSITIVE_DECIMAL_REGEX)
  amount!: string;
}
