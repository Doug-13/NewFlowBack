import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { OrganizationModule } from './organization/organization.module'
import { ProcessesModule } from './processes/processes.module'
import { DocumentsModule } from './documents/documents.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { MetadataModule } from './metadata/metadata.module'
import { EnvironmentSettingsModule } from './environment-settings/environment-settings.module'
import { WorkflowsModule } from './workflows/workflows.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    ProcessesModule,
    DocumentsModule,
    DashboardModule,
    MetadataModule,
    EnvironmentSettingsModule,
    WorkflowsModule,
  ],
})
export class AppModule {}
