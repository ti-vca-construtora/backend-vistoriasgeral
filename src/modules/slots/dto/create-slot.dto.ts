import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Matches } from 'class-validator';

export class CreateSlotDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  identerprise: number;

  @ApiProperty({ example: '2026-06-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato yyyy-mm-dd',
  })
  date: string;
}

