import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusGeneral, Situation } from '../overview.enums';

export class CreateOverviewDto {
  @ApiProperty({ description: 'ID do cliente', example: 1 })
  @IsNumber()
  idclient: number;

  @ApiPropertyOptional({ enum: StatusGeneral })
  @IsOptional()
  @IsEnum(StatusGeneral)
  status?: StatusGeneral;

  @ApiPropertyOptional({ example: 'PENDENTE' })
  @IsOptional()
  @IsString()
  status_quality?: string;

  @ApiPropertyOptional({ example: 'PENDENTE' })
  @IsOptional()
  @IsString()
  status_construction?: string;

  @ApiPropertyOptional({ example: 'PENDENTE' })
  @IsOptional()
  @IsString()
  status_delivery?: string;

  @ApiPropertyOptional({ example: 'Observações' })
  @IsOptional()
  @IsString()
  obs?: string;

  @ApiPropertyOptional({ enum: Situation })
  @IsOptional()
  @IsEnum(Situation)
  situation?: Situation;
}
