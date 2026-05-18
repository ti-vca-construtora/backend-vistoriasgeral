import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João Silva',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: 'Apto 101',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Vendedor responsável',
    example: 'Maria Santos',
  })
  @IsString()
  @IsNotEmpty()
  seller: string;

  @ApiProperty({
    description: 'Telefone do cliente',
    example: '5511987654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'ID da empresa',
    example: 1,
  })
  @IsNumber()
  identerprise: number;
}
