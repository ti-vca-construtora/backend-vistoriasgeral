import { ApiProperty } from '@nestjs/swagger';

export class EnterpriseResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}
