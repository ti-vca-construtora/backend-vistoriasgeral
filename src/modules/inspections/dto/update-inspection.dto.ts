import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateInspectionDto {
  @ApiPropertyOptional({
    description: 'AGUARDANDO | ACEITE | RECUSA | CANCELADA',
    example: 'ACEITE',
  })
  @IsOptional()
  @IsString()
  status?: string;

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
