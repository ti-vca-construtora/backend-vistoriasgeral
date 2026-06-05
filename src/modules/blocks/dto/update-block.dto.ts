import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBlockDto {
  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato yyyy-mm-dd',
  })
  date?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime deve estar no formato HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({ example: 'Equipe indisponivel' })
  @IsOptional()
  @IsString()
  reason?: string;
}
