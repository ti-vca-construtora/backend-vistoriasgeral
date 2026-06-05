import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [SupabaseModule],
  controllers: [BlocksController],
  providers: [BlocksService],
})
export class BlocksModule {}
