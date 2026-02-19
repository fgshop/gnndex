import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "trader@gnndex.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "GlobalDEX!2345" })
  @IsString()
  @MinLength(8)
  password!: string;
}
