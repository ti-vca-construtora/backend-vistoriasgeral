import { ApiProperty } from '@nestjs/swagger';

export class RejectionResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() idinspection: number;
  @ApiProperty({ nullable: true }) prevision_date: string | null;
  @ApiProperty() construction_status: string;
  @ApiProperty() status: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ nullable: true }) updated_at: string | null;
  @ApiProperty({ nullable: true }) obs: string | null;
  @ApiProperty({ nullable: true }) idclient: number | null;
  @ApiProperty({ nullable: true }) identerprise: number | null;
  @ApiProperty({ nullable: true }) nameenterprise: string | null;
}
