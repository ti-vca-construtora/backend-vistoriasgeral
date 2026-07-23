import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../infra/auth/auth-user';
import { UserRole } from '../../infra/auth/auth-user';
import { CurrentUser } from '../../infra/auth/current-user.decorator';
import { Roles } from '../../infra/auth/roles.decorator';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { QuerySatisfactionDto } from './dto/query-satisfaction.dto';
import { SatisfactionService } from './satisfaction.service';

@ApiTags('Satisfaction')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('satisfaction')
export class SatisfactionController {
  constructor(private readonly service: SatisfactionService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Indicadores de satisfacao e NPS' })
  summary(@Query() query: QuerySatisfactionDto, @CurrentUser() user: AuthUser) {
    return this.service.getSummary(query, user);
  }

  @Get('responses')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Listar pesquisas e respostas' })
  responses(
    @Query() query: QuerySatisfactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getResponses(query, user);
  }

  @Get('responses/:id')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Detalhar resposta de satisfacao' })
  response(@Param('id') id: number, @CurrentUser() user: AuthUser) {
    return this.service.getResponse(+id, user);
  }

  @Get('inspection/:inspectionId')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Consultar pesquisa de uma vistoria' })
  inspection(
    @Param('inspectionId') inspectionId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getByInspection(+inspectionId, user);
  }

  @Post('inspection/:inspectionId/ensure')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Criar ou carregar a pesquisa de uma vistoria' })
  ensure(
    @Param('inspectionId') inspectionId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.ensureForInspection(+inspectionId, user);
  }

  @Post(':id/notifications/send')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.INSPECTOR)
  @ApiOperation({ summary: 'Disparar manualmente a pesquisa pelo WhatsApp' })
  send(@Param('id') id: number, @CurrentUser() user: AuthUser) {
    return this.service.sendNotificationManually(+id, user);
  }

  @Post(':id/notifications/retry')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Reprocessar notificacao com falha' })
  retry(@Param('id') id: number, @CurrentUser() user: AuthUser) {
    return this.service.retryNotification(+id, user);
  }
}
