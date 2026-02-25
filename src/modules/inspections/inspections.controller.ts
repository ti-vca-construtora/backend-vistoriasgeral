import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiQuery,
  ApiResponse, ApiTags, ApiBody
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
import { InspectionResponseDto } from './dto/inspection-response.dto';
import { QueryInspectionDto } from './dto/query-inspection.dto';

@ApiTags('Inspections')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  // GET
  @ApiOperation({ summary: 'Listar vistorias' })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'idclient', required: false, type: Number })
  @ApiQuery({ name: 'inspector', required: false, type: String })
  @ApiQuery({ name: 'mobuss', required: false, type: Boolean })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'idprerejection', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Data inicial (yyyy-mm-dd)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Data final (yyyy-mm-dd)' })
  @ApiResponse({ status: 200, type: [InspectionResponseDto] })
  @Get()
  findAll(@Query() query: QueryInspectionDto) {
    return this.service.findAll(query);
  }

  // POST
  @ApiOperation({ summary: 'Criar vistoria' })
  @ApiBody({ type: CreateInspectionDto })
  @ApiResponse({ status: 201, type: InspectionResponseDto })
  @Post()
  create(@Body() dto: CreateInspectionDto) {
    return this.service.create(dto);
  }

  // PUT
  @ApiOperation({ summary: 'Atualizar vistoria' })
  @ApiBody({ type: UpdateInspectionDto })
  @ApiResponse({ status: 200, type: InspectionResponseDto })
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateInspectionDto) {
    return this.service.update(+id, dto);
  }

  // DELETE
  @ApiOperation({ summary: 'Deletar vistoria' })
  @ApiResponse({ status: 200 })
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
