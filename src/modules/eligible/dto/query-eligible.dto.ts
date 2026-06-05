import { IsOptional, IsIn } from 'class-validator';

export class QueryEligibleDto {
  @IsOptional()
  @IsIn(['new', 'again'], {
    message: 'O tipo deve ser "new" (primeira vistoria) ou "again" (reagendamento)'
  })
  type?: 'new' | 'again';
}
