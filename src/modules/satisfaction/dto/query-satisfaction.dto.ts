import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class QuerySatisfactionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  identerprise?: number;

  @IsOptional()
  @IsString()
  inspector?: string;

  @IsOptional()
  @IsIn(['PENDING', 'ANSWERED'])
  status?: 'PENDING' | 'ANSWERED';

  @IsOptional()
  @IsIn(['PROMOTER', 'PASSIVE', 'DETRACTOR'])
  segment?: 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
