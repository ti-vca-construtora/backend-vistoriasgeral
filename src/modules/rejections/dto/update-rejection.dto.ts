import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRejectionDto {
  @ApiPropertyOptional({ example: '2026-02-20' })
  @IsOptional()
  @IsString()
  prevision_date?: string;

  @ApiPropertyOptional({ example: 'EM ANDAMENTO' })
  @IsOptional()
  @IsString()
  construction_status?: string;

  @ApiPropertyOptional({ example: 'CONCLUÍDO' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Observações atualizadas' })
  @IsOptional()
  @IsString()
  obs?: string;
}
