import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RequestTradeSimulatorLiveApprovalDto {
  @ApiProperty({
    example: "자전거래 라이브 반영 필요. 운영 점검 윈도우 30분 동안 제한된 심볼로 적용 요청.",
    minLength: 8,
    maxLength: 1000
  })
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  reason!: string;
}
