import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({ example: "2026-02-12T07:21:31.120Z" })
  timestamp!: string;

  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  requestId!: string;

  @ApiProperty({ example: "VALIDATION_ERROR" })
  code!: string;

  @ApiProperty({ example: "Validation failed" })
  message!: string;

  @ApiProperty({ example: {} })
  details!: Record<string, unknown>;
}
