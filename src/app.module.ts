import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EnterprisesModule } from './modules/enterprises/enterprises.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OverviewModule } from './modules/overview/overview.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { RejectionsModule } from './modules/rejections/rejections.module';
import { EligibleModule } from './modules/eligible/eligible.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { SatisfactionModule } from './modules/satisfaction/satisfaction.module';
import { InspectionRemindersModule } from './modules/inspection-reminders/inspection-reminders.module';
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    EnterprisesModule,
    ClientsModule,
    OverviewModule,
    InspectionsModule,
    RejectionsModule,
    EligibleModule,
    TimelineModule,
    BlocksModule,
    SatisfactionModule,
    InspectionRemindersModule,
    DocumentsModule,
  ],
})
export class AppModule {}
