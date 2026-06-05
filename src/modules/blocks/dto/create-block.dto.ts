import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateBlockDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  identerprise: number;

  @ApiProperty({ example: '2026-06-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato yyyy-mm-dd',
  })
  date: string;

  @ApiPropertyOptional({ example: '09:00' })
  @ValidateIf((dto: CreateBlockDto) => !dto.times)
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @ValidateIf((dto: CreateBlockDto) => !dto.times)
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime deve estar no formato HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({ example: ['09:00', '14:30'] })
  @IsOptional()
  @IsArray()
  @Matches(/^\d{2}:\d{2}$/, {
    each: true,
    message: 'times deve conter horarios no formato HH:mm',
  })
  times?: string[];

  @ApiPropertyOptional({ example: 'Equipe indisponivel' })
  @IsOptional()
  @IsString()
  reason?: string;
}
