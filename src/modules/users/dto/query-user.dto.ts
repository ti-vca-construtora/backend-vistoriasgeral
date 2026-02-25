import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEmail } from 'class-validator';

export class QueryUserDto {
  @ApiPropertyOptional({ example: 'uuid-do-usuario' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 'user@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
