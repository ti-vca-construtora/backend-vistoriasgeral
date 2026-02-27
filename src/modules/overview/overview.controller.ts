import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { OverviewService } from './overview.service';
import { OverviewResponseDto } from './dto/overview-response.dto';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { UpdateOverviewDto } from './dto/update-overview.dto';

@ApiTags('Overview')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('overview')
export class OverviewController {
  constructor(private readonly service: OverviewService) {}

  // GET

  @ApiOperation({ summary: 'Listar overview (acompanhamento geral)' })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'idclient', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'situation', required: false, type: String })
  @ApiResponse({ status: 200, type: [OverviewResponseDto] })
  @Get()
  findAll(
    @Query('id') id?: number,
    @Query('idclient') idclient?: number,
    @Query('status') status?: string,
    @Query('situation') situation?: string,
  ) {
    return this.service.findAll({ id, idclient, status, situation });
  }

  // PUT

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar overview do cliente' })
  @ApiBody({ type: UpdateOverviewDto })
  @ApiResponse({ status: 200, description: 'Overview atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Transição de status inválida ou dados inválidos' })
  update(
    @Param('id') id: number,
    @Body() dto: UpdateOverviewDto,
  ) {
    return this.service.update(+id, dto);
  }

  // DELETE (removed — overview deletions are handled by client cascade)

}
