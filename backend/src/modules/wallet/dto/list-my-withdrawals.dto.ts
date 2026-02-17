import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListMyWithdrawalsQueryDto {
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    example: "REVIEW_PENDING",
    enum: [
      "REQUESTED",
      "REVIEW_PENDING",
      "APPROVED",
      "REJECTED",
      "BROADCASTED",
      "CONFIRMED",
      "FAILED"
    ]
  })
  @IsOptional()
  @IsIn([
    "REQUESTED",
    "REVIEW_PENDING",
    "APPROVED",
    "REJECTED",
    "BROADCASTED",
    "CONFIRMED",
    "FAILED"
  ])
  status?:
    | "REQUESTED"
    | "REVIEW_PENDING"
    | "APPROVED"
    | "REJECTED"
    | "BROADCASTED"
    | "CONFIRMED"
    | "FAILED";
}
