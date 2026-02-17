import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class LogoutDto {
  @ApiProperty({ example: "refresh_token_string" })
  @IsString()
  refreshToken!: string;
}
