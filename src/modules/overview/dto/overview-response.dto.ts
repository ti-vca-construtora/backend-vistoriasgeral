import { ApiProperty } from '@nestjs/swagger';
import { StatusGeneral, Situation, InspectionStatus } from '../overview.enums';

class InspectionRejectionDto {
  @ApiProperty() id: number;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) prevision_date: string | null;
  @ApiProperty() created_at: string;
  @ApiProperty({ nullable: true }) updated_at: string | null;
}

class InspectionDto {
  @ApiProperty() id: number;
  @ApiProperty() datetime: string;
  @ApiProperty({ nullable: true }) inspector: string | null;
  @ApiProperty() mobuss: boolean;
  @ApiProperty() status: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ nullable: true }) updated_at: string | null;

  @ApiProperty({ type: [InspectionRejectionDto] })
  rejections: InspectionRejectionDto[];
}

export class OverviewResponseDto {

  @ApiProperty({ enum: StatusGeneral, example: StatusGeneral.PENDENTE })
  status: StatusGeneral;

  @ApiProperty({ enum: Situation, example: Situation.ATIVO })
  situation: Situation;

  @ApiProperty({
    enum: InspectionStatus,
    example: InspectionStatus.AGUARDANDO,
    description: 'Status recente calculado',
  })
  status_recente: InspectionStatus | 'PENDENTE';

  
  @ApiProperty({ example: 'PENDENTE', nullable: true })
  status_quality: string | null;

  status_construction: string | null;

  @ApiProperty({ example: 'PENDENTE', nullable: true })
  status_delivery: string | null;

  @ApiProperty({ nullable: true }) data_register: string | null;
  @ApiProperty({ nullable: true }) data_contact: string | null;
  @ApiProperty({ nullable: true }) obs: string | null;

  @ApiProperty({
    example: 'AGUARDANDO',
    description: 'Status recente calculado a partir das vistorias/recusas',
  })

  @ApiProperty({ type: [InspectionDto] })
  inspections: InspectionDto[];
}
