import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EnterprisesModule } from './modules/enterprises/enterprises.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OverviewModule } from './modules/overview/overview.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { RejectionsModule } from './modules/rejections/rejections.module';
import { EligibleModule } from './modules/eligible/eligible.module';
import { TimelineModule } from './modules/timeline/timeline.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    UsersModule,
    EnterprisesModule,
    ClientsModule,
    OverviewModule,
    InspectionsModule,
    RejectionsModule,
    EligibleModule,
    TimelineModule
  ],
})

export class AppModule {}
