import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../infra/auth/auth-user';

export class UserEnterpriseResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  name: string | null;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ type: [UserEnterpriseResponseDto] })
  enterprises: UserEnterpriseResponseDto[];

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}
