import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '../../infra/auth/auth-user';
import { Roles } from '../../infra/auth/roles.decorator';
import { RolesGuard } from '../../infra/auth/roles.guard';
import { SupabaseAuthGuard } from '../../infra/auth/supabase-auth.guard';
import { UpdateDocumentsLinkDto } from './dto/update-documents-link.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.service.list();
  }

  @Get('orientations/:enterpriseId')
  @Roles(UserRole.ADMIN, UserRole.USER, UserRole.INSPECTOR)
  orientation(@Param('enterpriseId') enterpriseId: number) {
    return this.service.findOrientation(+enterpriseId);
  }

  @Post('orientations/:enterpriseId')
  @Roles(UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Publicar PDF de orientacoes do empreendimento' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @Param('enterpriseId') enterpriseId: number,
    @UploadedFile() file: any,
    @Body('title') title?: string,
  ) {
    return this.service.uploadOrientation(+enterpriseId, file, title);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }

  @Get('settings/sidebar-link')
  sidebarLink() {
    return this.service.getSidebarLink();
  }

  @Put('settings/sidebar-link')
  @Roles(UserRole.ADMIN)
  updateSidebarLink(@Body() dto: UpdateDocumentsLinkDto) {
    return this.service.updateSidebarLink(dto.url);
  }
}

@ApiTags('Public documents')
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get(':token')
  async file(@Param('token') token: string, @Res() response: Response) {
    const file = await this.service.getPublicFile(token);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(file.buffer);
  }
}
