import { Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class VerifyEventsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];
}
