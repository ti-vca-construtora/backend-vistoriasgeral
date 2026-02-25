import {
  Controller, Get, Put, Delete,
  Body, Param, Query, UseGuards
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiQuery,
  ApiResponse, ApiTags, ApiBody
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { RejectionsService } from './rejections.service';
import { UpdateRejectionDto } from './dto/update-rejection.dto';
import { RejectionResponseDto } from './dto/rejection-response.dto';
import { QueryRejectionDto } from './dto/query-rejection.dto';

@ApiTags('Rejections')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('rejections')
export class RejectionsController {
  constructor(private readonly service: RejectionsService) {}

  // GET
  @ApiOperation({ summary: 'Listar recusas' })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'idinspection', required: false, type: Number })
  @ApiQuery({ name: 'idclient', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'construction_status', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Data inicial (yyyy-mm-dd)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Data final (yyyy-mm-dd)' })
  @ApiResponse({ status: 200, type: [RejectionResponseDto] })
  @Get()
  findAll(@Query() query: QueryRejectionDto) {
    return this.service.findAll(query);
  }

  // PUT
  @ApiOperation({ summary: 'Atualizar recusa' })
  @ApiBody({ type: UpdateRejectionDto })
  @ApiResponse({ status: 200, type: RejectionResponseDto })
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateRejectionDto) {
    return this.service.update(+id, dto);
  }

  // DELETE
  @ApiOperation({ summary: 'Deletar recusa' })
  @ApiResponse({ status: 200 })
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
