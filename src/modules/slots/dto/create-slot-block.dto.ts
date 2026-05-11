import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateSlotBlockDto {
  @ApiProperty({ example: ['09:00', '14:30'] })
  @IsArray()
  @ArrayNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    each: true,
    message: 'times deve conter horarios no formato HH:mm',
  })
  times: string[];

  @ApiPropertyOptional({ example: 'Equipe indisponivel' })
  @IsOptional()
  @IsString()
  reason?: string;
}

