import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  Matches,
} from 'class-validator';

export class QueryRejectionDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  idinspection?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  idclient?: number;

  @ApiPropertyOptional({ example: 'AGUARDANDO' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'PENDENTE' })
  @IsOptional()
  @IsString()
  construction_status?: string;

  @ApiPropertyOptional({
    description: 'Data inicial no formato yyyy-mm-dd',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from deve estar no formato yyyy-mm-dd',
  })
  from?: string;

  @ApiPropertyOptional({
    description: 'Data final no formato yyyy-mm-dd',
    example: '2026-02-05',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to deve estar no formato yyyy-mm-dd',
  })
  to?: string;
}
