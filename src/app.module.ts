import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { JwtAuthGuard } from './common/jwt-auth.guard'
import { AuthModule }          from './modules/auth/auth.module'
import { UsersModule }         from './modules/users/users.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { ProcessesModule }     from './modules/processes/processes.module'
import { MetadataModule }      from './modules/metadata/metadata.module'
import { WorkflowModule }      from './modules/workflow/workflow.module'
import { WorkflowsModule }     from './modules/workflows/workflows.module'
import { DocumentsModule }     from './modules/documents/documents.module'
import { TasksModule }         from './modules/tasks/tasks.module'
import { EnvironmentModule }   from './modules/environment/environment.module'
import { NotificationsModule } from './modules/notifications/notifications.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI')
        console.log('🔗 Conectando ao MongoDB:', uri?.split('@')[1] ?? uri)
        return {
          uri,
          connectionFactory: (connection: any) => {
            connection.on('connected', () => console.log('✅ MongoDB conectado'))
            connection.on('error', (err: any) => console.error('❌ MongoDB erro:', err))
            return connection
          },
        }
      },
    }),

    JwtModule.registerAsync({
      global:  true,
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:      config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
      }),
    }),

    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProcessesModule,
    MetadataModule,
    WorkflowModule,
    WorkflowsModule,
    DocumentsModule,
    TasksModule,
    EnvironmentModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}