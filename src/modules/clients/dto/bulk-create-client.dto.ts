import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

export class BulkCreateClientDto {
  @ApiProperty({
    description: 'Lista de clientes para importação em lote',
    type: [CreateClientDto],
    example: [
      { name: 'João Silva', unit: 'Apto 101', seller: 'Maria Santos', identerprise: 1 },
      { name: 'Ana Costa', unit: 'Apto 102', seller: 'Maria Santos', identerprise: 1 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => CreateClientDto)
  clients: CreateClientDto[];
}

export class BulkCreateResultDto {
  @ApiProperty({ description: 'Total de clientes enviados', example: 100 })
  total: number;

  @ApiProperty({ description: 'Total inseridos com sucesso', example: 95 })
  inserted: number;

  @ApiProperty({ description: 'Total ignorados (duplicados)', example: 5 })
  skipped: number;

  @ApiProperty({
    description: 'Lista de clientes que foram ignorados e o motivo',
    example: [
      { name: 'João Silva', unit: 'Apto 101', reason: 'Cliente já existe neste empreendimento' },
    ],
  })
  skippedDetails: { name: string; unit: string; reason: string }[];
}
