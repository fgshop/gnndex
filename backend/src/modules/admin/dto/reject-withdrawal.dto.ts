import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectWithdrawalDto {
  @ApiProperty({ example: "Risk policy violation" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
