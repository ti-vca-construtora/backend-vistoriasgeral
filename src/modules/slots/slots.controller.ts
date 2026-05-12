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
import { CreateSlotBlockDto } from './dto/create-slot-block.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { QuerySlotDto } from './dto/query-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { SlotsService } from './slots.service';

@ApiTags('Slots')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('slots')
export class SlotsController {
  constructor(private readonly service: SlotsService) {}

  @ApiOperation({ summary: 'Listar slots de vistoria' })
  @ApiQuery({ name: 'identerprise', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200 })
  @Get()
  findAll(@Query() query: QuerySlotDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @ApiOperation({ summary: 'Criar slot diario de vistoria' })
  @ApiBody({ type: CreateSlotDto })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateSlotDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Atualizar status do slot' })
  @ApiBody({ type: UpdateSlotDto })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateSlotDto) {
    return this.service.update(+id, dto);
  }

  @ApiOperation({ summary: 'Bloquear horarios de um slot' })
  @ApiBody({ type: CreateSlotBlockDto })
  @Roles(UserRole.ADMIN)
  @Post(':id/blocks')
  createBlocks(@Param('id') id: number, @Body() dto: CreateSlotBlockDto) {
    return this.service.createBlocks(+id, dto);
  }

  @ApiOperation({ summary: 'Remover bloqueio de horario de um slot' })
  @Roles(UserRole.ADMIN)
  @Delete(':id/blocks/:blockId')
  removeBlock(@Param('id') id: number, @Param('blockId') blockId: number) {
    return this.service.removeBlock(+id, +blockId);
  }

  @ApiOperation({ summary: 'Remover slot de vistoria' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
