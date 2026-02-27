import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { StatusGeneral, Situation } from '../overview.enums';

export class UpdateOverviewDto {
  @ApiPropertyOptional({
    example: '2026-02-27T10:00:00.000Z',
    description: 'Data de registro (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  data_register?: string;

  @ApiPropertyOptional({
    example: '2026-02-27T11:00:00.000Z',
    description: 'Data de contato (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  data_contact?: string;

  @ApiPropertyOptional({ example: 'OK' })
  @IsOptional()
  @IsString()
  status_quality?: string;

  @ApiPropertyOptional({ example: 'CONCLUÍDA' })
  @IsOptional()
  @IsString()
  status_construction?: string;

  @ApiPropertyOptional({ example: 'OK' })
  @IsOptional()
  @IsString()
  status_delivery?: string;

  @ApiPropertyOptional({ enum: StatusGeneral })
  @IsOptional()
  @IsEnum(StatusGeneral)
  status?: StatusGeneral;

  @ApiPropertyOptional({ example: 'Observações atualizadas' })
  @IsOptional()
  @IsString()
  obs?: string;

  @ApiPropertyOptional({ enum: Situation })
  @IsOptional()
  @IsEnum(Situation)
  situation?: Situation;
}
