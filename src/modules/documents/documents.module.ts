import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import {
  DocumentsController,
  PublicDocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [DocumentsController, PublicDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
