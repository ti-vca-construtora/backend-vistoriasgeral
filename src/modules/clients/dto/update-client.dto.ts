import { IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

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
    description: 'Telefone do cliente',
    example: '5511987654321',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined ? value : String(value),
  )
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'ID da empresa',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  identerprise?: number;
}
