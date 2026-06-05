import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../infra/auth/current-user.decorator';
import { UserRole } from '../../infra/auth/auth-user';
import type { AuthUser } from '../../infra/auth/auth-user';
import { Roles } from '../../infra/auth/roles.decorator';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { QueryBlockDto } from './dto/query-block.dto';
import { UpdateBlockDto } from './dto/update-block.dto';

@ApiTags('Blocks')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('blocks')
export class BlocksController {
  constructor(private readonly service: BlocksService) {}

  @ApiOperation({ summary: 'Listar bloqueios de agenda por empreendimento' })
  @ApiQuery({ name: 'identerprise', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200 })
  @Get()
  findAll(@Query() query: QueryBlockDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @ApiOperation({ summary: 'Criar bloqueio de agenda por empreendimento' })
  @ApiBody({ type: CreateBlockDto })
  @ApiResponse({ status: 201 })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateBlockDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiOperation({ summary: 'Atualizar bloqueio de agenda' })
  @ApiBody({ type: UpdateBlockDto })
  @ApiResponse({ status: 200 })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(+id, dto, user);
  }

  @ApiOperation({ summary: 'Remover bloqueio de agenda' })
  @ApiResponse({ status: 200 })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(+id, user);
  }
}
