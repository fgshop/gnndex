import { AdminPermission } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsEnum } from "class-validator";

export class UpdateAdminPermissionsDto {
  @ApiProperty({
    type: "array",
    items: { type: "string", enum: Object.values(AdminPermission) },
    example: ["USER_READ", "WITHDRAWAL_READ", "WITHDRAWAL_APPROVE"]
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(AdminPermission, { each: true })
  permissions!: AdminPermission[];
}
