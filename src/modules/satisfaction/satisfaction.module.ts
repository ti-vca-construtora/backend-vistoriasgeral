import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { HuggyClient } from './huggy.client';
import { PublicSatisfactionController } from './public-satisfaction.controller';
import { SatisfactionController } from './satisfaction.controller';
import { SatisfactionService } from './satisfaction.service';
import { SatisfactionWorker } from './satisfaction.worker';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [PublicSatisfactionController, SatisfactionController],
  providers: [SatisfactionWorker, SatisfactionService, HuggyClient],
  exports: [SatisfactionService, HuggyClient],
})
export class SatisfactionModule {}
