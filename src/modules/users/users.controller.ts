import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { Roles } from '../../infra/auth/roles.decorator';
import type { AuthUser } from '../../infra/auth/auth-user';
import { UserRole } from '../../infra/auth/auth-user';
import { CurrentUser } from '../../infra/auth/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.INSPECTOR,
    UserRole.VIEWER,
  )
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Get()
  @ApiOkResponse({ type: [UserResponseDto] })
  async find(@Query() query: QueryUserDto) {
    if (query.id) {
      return this.usersService.findById(query.id);
    }

    if (query.email) {
      return this.usersService.findByEmail(query.email);
    }

    return this.usersService.findAll();
  }

  @Post()
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiParam({ name: 'id', example: 'uuid-do-usuario' })
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', example: 'uuid-do-usuario' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
