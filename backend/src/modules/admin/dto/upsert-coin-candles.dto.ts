import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

class CandleInputDto {
  @ApiProperty({ example: "2026-02-13T10:00:00.000Z" })
  @IsDateString()
  openTime!: string;

  @ApiProperty({ example: "2026-02-13T10:01:00.000Z" })
  @IsDateString()
  closeTime!: string;

  @ApiProperty({ example: 0.8123 })
  @Type(() => Number)
  @IsNumber()
  open!: number;

  @ApiProperty({ example: 0.8199 })
  @Type(() => Number)
  @IsNumber()
  high!: number;

  @ApiProperty({ example: 0.8021 })
  @Type(() => Number)
  @IsNumber()
  low!: number;

  @ApiProperty({ example: 0.8175 })
  @Type(() => Number)
  @IsNumber()
  close!: number;

  @ApiProperty({ example: 13250.44 })
  @Type(() => Number)
  @IsNumber()
  volume!: number;
}

export class UpsertCoinCandlesDto {
  @ApiProperty({ enum: INTERVALS, example: "1m" })
  @IsString()
  @IsIn(INTERVALS)
  interval!: (typeof INTERVALS)[number];

  @ApiProperty({ type: [CandleInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CandleInputDto)
  candles!: CandleInputDto[];

  @ApiProperty({ example: true, required: false, description: "Delete existing candles with same symbol+interval before insert" })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
