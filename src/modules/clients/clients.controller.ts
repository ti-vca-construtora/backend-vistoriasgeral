import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { BulkCreateClientDto, BulkCreateResultDto } from './dto/bulk-create-client.dto';

@ApiTags('Clients')
@Controller('clients')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @ApiQuery({ name: 'id', required: false, type: Number, description: 'Filtrar por ID do cliente' })
  @ApiQuery({ name: 'identerprise', required: false, type: Number, description: 'Filtrar por ID da empresa' })
  @ApiResponse({ status: 200, description: 'Lista de clientes', type: [ClientResponseDto] })
  @Get()
  findAll(
    @Query('id') id?: number,
    @Query('identerprise') identerprise?: number,
  ) {
    return this.service.findAll({ id, identerprise });
  }

  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso', type: ClientResponseDto })
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Importação em lote de clientes' })
  @ApiBody({ type: BulkCreateClientDto })
  @ApiResponse({ status: 201, description: 'Resultado da importação', type: BulkCreateResultDto })
  @Post('import')
  bulkCreate(@Body() dto: BulkCreateClientDto) {
    return this.service.bulkCreate(dto.clients);
  }

  @ApiBody({ type: UpdateClientDto })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso', type: ClientResponseDto })
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateClientDto) {
    return this.service.update(+id, dto);
  }

  @ApiResponse({ status: 200, description: 'Cliente deletado com sucesso' })
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
