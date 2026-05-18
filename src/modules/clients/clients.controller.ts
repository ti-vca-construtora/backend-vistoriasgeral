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
import { UserRole } from '../../infra/auth/auth-user';
import type { AuthUser } from '../../infra/auth/auth-user';
import { CurrentUser } from '../../infra/auth/current-user.decorator';
import { Roles } from '../../infra/auth/roles.decorator';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { BulkCreateClientDto, BulkCreateResultDto } from './dto/bulk-create-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@ApiTags('Clients')
@Controller('clients')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @ApiQuery({ name: 'id', required: false, type: Number, description: 'Filtrar por ID do cliente' })
  @ApiQuery({ name: 'identerprise', required: false, type: Number, description: 'Filtrar por ID da empresa' })
  @ApiResponse({ status: 200, description: 'Lista de clientes', type: [ClientResponseDto] })
  @Get()
  findAll(
    @Query('id') id: number | undefined,
    @Query('identerprise') identerprise: number | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll({ id, identerprise }, user);
  }

  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso', type: ClientResponseDto })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Importacao em lote de clientes' })
  @ApiBody({ type: BulkCreateClientDto })
  @ApiResponse({ status: 201, description: 'Resultado da importacao', type: BulkCreateResultDto })
  @Roles(UserRole.ADMIN)
  @Post('import')
  bulkCreate(@Body() dto: BulkCreateClientDto) {
    return this.service.bulkCreate(dto.clients);
  }

  @ApiBody({ type: UpdateClientDto })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso', type: ClientResponseDto })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateClientDto) {
    return this.service.update(+id, dto);
  }

  @ApiResponse({ status: 200, description: 'Cliente deletado com sucesso' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
