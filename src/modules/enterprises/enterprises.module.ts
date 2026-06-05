import { Module } from '@nestjs/common';
import { EnterprisesController } from './enterprises.controller';
import { EnterprisesService } from './enterprises.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EnterprisesController],
  providers: [EnterprisesService],
})
export class EnterprisesModule {}
