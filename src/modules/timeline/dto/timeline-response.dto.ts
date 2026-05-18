import { ApiProperty } from '@nestjs/swagger';
import { TimelineEventDto } from './timeline-event.dto';

export class TimelineResponseDto {
  @ApiProperty({
    description: 'ID do cliente',
    example: 1,
  })
  clientId: number;

  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João Silva',
  })
  clientName: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: 'Apto 101',
  })
  unit: string;

  @ApiProperty({
    type: [TimelineEventDto],
    description: 'Lista de eventos ordenados cronologicamente',
  })
  events: TimelineEventDto[];
}
