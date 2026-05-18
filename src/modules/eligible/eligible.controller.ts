import {
  Controller,
  Get,
  Query,
  UseGuards
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { EligibleService } from './eligible.service';
import { QueryEligibleDto } from './dto/query-eligible.dto';
import { EligibleResponseDto } from './dto/eligible-response.dto';

@ApiTags('Eligible')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('eligible')
export class EligibleController {
  constructor(private readonly service: EligibleService) {}

  @ApiOperation({
    summary: 'Listar clientes aptos para vistoria',
    description: `
      Retorna clientes elegíveis para agendamento de vistoria:
      - Sem type: Retorna TODOS (new + again)
      - type=new: Clientes com status LIBERADA que nunca tiveram vistoria
      - type=again: Clientes com recusa CONCLUÍDA que não reagendaram
    `
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['new', 'again'],
    description: 'Tipo de elegibilidade: "new" (primeira vistoria), "again" (reagendamento) ou omitir para ambos'
  })
  @ApiResponse({ status: 200, type: [EligibleResponseDto] })
  @Get()
  findAll(@Query() query: QueryEligibleDto) {
    return this.service.findAll(query);
  }
}
