import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { OrderSide, OrderType } from "../../../common/enums/order.enum";

const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

export class CreateOrderDto {
  @ApiProperty({ example: "BTC-USDT" })
  @IsString()
  symbol!: string;

  @ApiProperty({ enum: OrderSide, example: OrderSide.BUY })
  @IsEnum(OrderSide)
  side!: OrderSide;

  @ApiProperty({ enum: OrderType, example: OrderType.LIMIT })
  @IsEnum(OrderType)
  type!: OrderType;

  @ApiProperty({ example: "51000.25", required: false })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_REGEX)
  price?: string;

  @ApiProperty({ example: "0.010" })
  @IsString()
  @Matches(DECIMAL_REGEX)
  quantity!: string;
}
