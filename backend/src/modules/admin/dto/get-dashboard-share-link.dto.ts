import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";

export class GetDashboardShareLinkParamDto {
  @ApiProperty({
    example: "a8Ks2vP3Qn",
    description: "Dashboard share link code"
  })
  @IsString()
  @MaxLength(24)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: "shareCode must contain only alphanumeric characters"
  })
  shareCode!: string;
}
