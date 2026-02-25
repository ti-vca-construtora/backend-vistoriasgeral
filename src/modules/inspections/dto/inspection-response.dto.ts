import { ApiProperty } from '@nestjs/swagger';

export class InspectionResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() idclient: number;
  @ApiProperty() datetime: string;
  @ApiProperty({ nullable: true }) inspector: string | null;
  @ApiProperty() mobuss: boolean;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true }) idprerejection: number | null;
  @ApiProperty() created_at: string;
  @ApiProperty({ nullable: true }) updated_at: string | null;
  @ApiProperty({ nullable: true }) obs: string | null;
}
