import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { SatisfactionModule } from '../satisfaction/satisfaction.module';
import { InspectionReminderScheduler } from './inspection-reminder.scheduler';

@Module({
  imports: [ConfigModule, SupabaseModule, SatisfactionModule],
  providers: [InspectionReminderScheduler],
})
export class InspectionRemindersModule {}
