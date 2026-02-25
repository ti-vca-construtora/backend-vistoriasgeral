import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { StatusGeneral, Situation } from '../overview.enums';

export class UpdateOverviewDto {
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
