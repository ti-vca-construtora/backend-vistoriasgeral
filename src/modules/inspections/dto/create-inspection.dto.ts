import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInspectionDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  idclient: number;

  @ApiProperty({ example: '2026-01-20T10:00:00Z' })
  @IsString()
  datetime: string;

  @ApiPropertyOptional({ example: 'João Vistoriador' })
  @IsOptional()
  @IsString()
  inspector?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  mobuss?: boolean;

  @ApiPropertyOptional({
    description: 'ID da recusa anterior (quando for nova vistoria pós-recusa)',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  idprerejection?: number;

  @ApiPropertyOptional({ example: 'Observações' })
  @IsOptional()
  @IsString()
  obs?: string;
}
