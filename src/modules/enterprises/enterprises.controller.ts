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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { UserRole } from '../../infra/auth/auth-user';
import type { AuthUser } from '../../infra/auth/auth-user';
import { CurrentUser } from '../../infra/auth/current-user.decorator';
import { Roles } from '../../infra/auth/roles.decorator';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { EnterprisesService } from './enterprises.service';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { EnterpriseResponseDto } from './dto/enterprise-response.dto';

@ApiTags('Enterprises')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('enterprises')
export class EnterprisesController {
  constructor(private readonly enterprisesService: EnterprisesService) {}

  @Get()
  @ApiQuery({ name: 'id', required: false })
  @ApiOkResponse({ type: [EnterpriseResponseDto] })
  find(@CurrentUser() user: AuthUser, @Query('id') id?: number) {
    if (id) {
      return this.enterprisesService.findById(Number(id), user);
    }

    return this.enterprisesService.findAll(user);
  }

  @Post()
  @ApiCreatedResponse({ type: EnterpriseResponseDto })
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateEnterpriseDto) {
    return this.enterprisesService.create(dto);
  }

  @Put(':id')
  @ApiParam({ name: 'id' })
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: number,
    @Body() dto: UpdateEnterpriseDto,
  ) {
    return this.enterprisesService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id' })
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number) {
    return this.enterprisesService.remove(Number(id));
  }
}
