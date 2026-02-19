import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, Length } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "trader@gnndex.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "GlobalDEX!2345" })
  @IsString()
  password!: string;

  @ApiProperty({ example: "123456", required: false })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  twoFactorCode?: string;

  @ApiProperty({ example: "Mozilla/5.0", required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ example: "203.0.113.10", required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}
