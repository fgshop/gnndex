import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ReviewTradeSimulatorLiveApprovalDto {
  @ApiProperty({ enum: ["APPROVE", "REJECT"], example: "APPROVE" })
  @IsString()
  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @ApiPropertyOptional({ example: "승인 조건 확인 완료", minLength: 2, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason?: string;
}
