import { ApiProperty } from '@nestjs/swagger';

export class ClientResponseDto {
  @ApiProperty({
    description: 'ID único do cliente',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João Silva',
  })
  name: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: 'Apto 101',
  })
  unit: string;

  @ApiProperty({
    description: 'Vendedor responsável',
    example: 'Maria Santos',
  })
  seller: string;

  @ApiProperty({
    description: 'Telefone do cliente',
    example: '5511987654321',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    description: 'ID da empresa',
    example: 1,
  })
  identerprise: number;

  @ApiProperty({
    description: 'Data de criação',
    example: '2026-01-16T15:00:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Data de atualização',
    example: '2026-01-16T15:30:00Z',
    nullable: true,
  })
  updated_at: string | null;
}
