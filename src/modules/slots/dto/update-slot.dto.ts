import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SlotStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class UpdateSlotDto {
  @ApiProperty({ enum: SlotStatus, example: SlotStatus.ACTIVE })
  @IsEnum(SlotStatus)
  status: SlotStatus;
}

