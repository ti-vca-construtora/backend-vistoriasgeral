import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateSlotBlockDto {
  @ApiPropertyOptional({ example: '09:00' })
  @ValidateIf((dto: CreateSlotBlockDto) => !dto.times)
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @ValidateIf((dto: CreateSlotBlockDto) => !dto.times)
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
