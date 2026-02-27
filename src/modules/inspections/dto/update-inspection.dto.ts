import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdateInspectionDto {
  @ApiPropertyOptional({
    description: 'AGUARDANDO | ACEITE | RECUSA | CANCELADA',
    example: 'ACEITE',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Data e hora da vistoria (ISO 8601)',
    example: '2026-03-15T14:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  datetime?: string;

  @ApiPropertyOptional({ example: 'Maria Vistoriadora' })
  @IsOptional()
  @IsString()
  inspector?: string;

  @ApiPropertyOptional({ example: 'Observações atualizadas' })
  @IsOptional()
  @IsString()
  obs?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  mobuss?: boolean;
}
