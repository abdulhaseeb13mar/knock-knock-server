import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GmailIntegrationModule } from './integrations/gmail/gmail.module';
import { AiModule } from './ai/ai.module';
import { RecipientsModule } from './recipients/recipients.module';
import { JobsModule } from './jobs/jobs.module';
import { EmailsModule } from './emails/emails.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 100 }]),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    PrismaModule,
    CommonModule,
    StorageModule,
    AuditModule,
    AuthModule,
    UsersModule,
    GmailIntegrationModule,
    AiModule,
    RecipientsModule,
    JobsModule,
    EmailsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
