import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}

