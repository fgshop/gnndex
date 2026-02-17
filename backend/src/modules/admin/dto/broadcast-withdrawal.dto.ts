import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class BroadcastWithdrawalDto {
  @ApiProperty({ example: "0xabc123..." })
  @IsString()
  @MinLength(10)
  txHash!: string;
}
