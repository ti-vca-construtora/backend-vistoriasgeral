import { ApiProperty } from '@nestjs/swagger';

export enum TimelineEventType {
  CLIENT_CREATED = 'CLIENT_CREATED',
  UNIT_RELEASED = 'UNIT_RELEASED',
  INSPECTION_SCHEDULED = 'INSPECTION_SCHEDULED',
  INSPECTION_APPROVED = 'INSPECTION_APPROVED',
  INSPECTION_REJECTED = 'INSPECTION_REJECTED',
  REJECTION_RESOLVED = 'REJECTION_RESOLVED',
}

export class TimelineEventDto {
  @ApiProperty({
    enum: TimelineEventType,
    description: 'Tipo do evento',
    example: TimelineEventType.CLIENT_CREATED,
  })
  type: TimelineEventType;

  @ApiProperty({
    description: 'Data do evento',
    example: '2026-01-16T15:00:00Z',
  })
  date: string;

  @ApiProperty({
    description: 'Descrição do evento',
    example: 'Cliente cadastrado no sistema',
  })
  description: string;

  @ApiProperty({
    description: 'Dados adicionais do evento',
    required: false,
    nullable: true,
  })
  metadata?: any;
}
