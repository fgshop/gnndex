import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class EnableTwoFactorDto {
  @ApiProperty({ example: "trader@gnndex.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "GnnDEX!2345" })
  @IsString()
  password!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  code!: string;
}
