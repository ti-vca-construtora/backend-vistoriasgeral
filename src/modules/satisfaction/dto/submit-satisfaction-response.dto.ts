import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const RATING_PROPERTY = {
  minimum: 1,
  maximum: 5,
  example: 5,
};

export class SubmitSatisfactionResponseDto {
  @ApiProperty(RATING_PROPERTY)
  @IsInt()
  @Min(1)
  @Max(5)
  service_rating: number;

  @ApiProperty(RATING_PROPERTY)
  @IsInt()
  @Min(1)
  @Max(5)
  broker_rating: number;

  @ApiProperty(RATING_PROPERTY)
  @IsInt()
  @Min(1)
  @Max(5)
  inspector_rating: number;

  @ApiProperty(RATING_PROPERTY)
  @IsInt()
  @Min(1)
  @Max(5)
  common_areas_rating: number;

  @ApiProperty(RATING_PROPERTY)
  @IsInt()
  @Min(1)
  @Max(5)
  unit_quality_rating: number;

  @ApiProperty({ minimum: 0, maximum: 10, example: 10 })
  @IsInt()
  @Min(0)
  @Max(10)
  recommendation_score: number;

  @ApiPropertyOptional({
    enum: [
      'TEAM_SERVICE',
      'DELIVERY_ORGANIZATION',
      'PROPERTY_QUALITY',
      'INFORMATION_TRANSPARENCY',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'TEAM_SERVICE',
    'DELIVERY_ORGANIZATION',
    'PROPERTY_QUALITY',
    'INFORMATION_TRANSPARENCY',
  ])
  positive_highlight?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
