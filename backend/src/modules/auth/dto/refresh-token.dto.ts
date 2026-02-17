import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({ example: "refresh_token_string" })
  @IsString()
  refreshToken!: string;

  @ApiProperty({ example: "Mozilla/5.0", required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ example: "203.0.113.10", required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}
