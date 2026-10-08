import { Module } from '@nestjs/common';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { InspectionRemindersModule } from '../inspection-reminders/inspection-reminders.module';

@Module({
  imports: [SupabaseModule, InspectionRemindersModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
})
export class InspectionsModule {}
