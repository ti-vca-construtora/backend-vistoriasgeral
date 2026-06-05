import { Module } from '@nestjs/common';
import { RejectionsController } from './rejections.controller';
import { RejectionsService } from './rejections.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [RejectionsController],
  providers: [RejectionsService],
})
export class RejectionsModule {}
