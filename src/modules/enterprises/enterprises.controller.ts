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
import { EnterprisesService } from './enterprises.service';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { EnterpriseResponseDto } from './dto/enterprise-response.dto';

@ApiTags('Enterprises')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('enterprises')
export class EnterprisesController {
  constructor(private readonly enterprisesService: EnterprisesService) {}

  @Get()
  @ApiQuery({ name: 'id', required: false })
  @ApiOkResponse({ type: [EnterpriseResponseDto] })
  find(@Query('id') id?: number) {
    if (id) {
      return this.enterprisesService.findById(Number(id));
    }

    return this.enterprisesService.findAll();
  }

  @Post()
  @ApiCreatedResponse({ type: EnterpriseResponseDto })
  create(@Body() dto: CreateEnterpriseDto) {
    return this.enterprisesService.create(dto);
  }

  @Put(':id')
  @ApiParam({ name: 'id' })
  update(
    @Param('id') id: number,
    @Body() dto: UpdateEnterpriseDto,
  ) {
    return this.enterprisesService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: number) {
    return this.enterprisesService.remove(Number(id));
  }
}
