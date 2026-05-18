import { Module } from '@nestjs/common';
import { EligibleController } from './eligible.controller';
import { EligibleService } from './eligible.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EligibleController],
  providers: [EligibleService],
  exports: [EligibleService]
})
export class EligibleModule {}
