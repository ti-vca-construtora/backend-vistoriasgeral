import { ApiProperty } from '@nestjs/swagger';

export class EligibleResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'João Silva' })
  name: string;

  @ApiProperty({ example: '101' })
  unit: string;

  @ApiProperty({ example: 'Maria Santos' })
  seller: string;

  @ApiProperty({ example: 1 })
  identerprise: number;

  @ApiProperty({ example: 'Residencial Alegria' })
  nameenterprise: string;

  @ApiProperty({ example: 'LIBERADA' })
  status?: string;

  @ApiProperty({ example: 'new' })
  type: 'new' | 'again';

  @ApiProperty({ example: 1, nullable: true })
  idrejection?: number | null;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-01-20T14:30:00.000Z' })
  updated_at: string;
}
