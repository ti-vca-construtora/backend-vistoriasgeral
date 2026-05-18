import { IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João Silva',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: 'Apto 101',
    required: false,
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    description: 'Vendedor responsável',
    example: 'Maria Santos',
    required: false,
  })
  @IsOptional()
  @IsString()
  seller?: string;

  @ApiProperty({
    description: 'ID da empresa',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  identerprise?: number;
}
