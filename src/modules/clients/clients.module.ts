import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
