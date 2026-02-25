import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateEnterpriseDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;
}
