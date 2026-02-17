import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class FailWithdrawalDto {
  @ApiProperty({ example: "Node broadcast timeout" })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
