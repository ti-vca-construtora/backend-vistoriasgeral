import { Controller, Get, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';

@ApiTags('Timeline')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get(':idclient')
  @ApiOperation({ summary: 'Obter timeline completa de um cliente' })
  @ApiResponse({
    status: 200,
    description: 'Timeline do cliente retornada com sucesso',
    type: TimelineResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  async getTimeline(
    @Param('idclient', ParseIntPipe) idclient: number,
  ): Promise<TimelineResponseDto> {
    return this.timelineService.getClientTimeline(idclient);
  }
}
