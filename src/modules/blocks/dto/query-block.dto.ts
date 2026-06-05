import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Matches } from 'class-validator';

export class QueryBlockDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  identerprise?: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from deve estar no formato yyyy-mm-dd',
  })
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to deve estar no formato yyyy-mm-dd',
  })
  to?: string;
}
