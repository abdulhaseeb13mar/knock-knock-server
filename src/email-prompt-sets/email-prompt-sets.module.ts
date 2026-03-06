import { Module } from '@nestjs/common';
import { EmailPromptSetsController } from './email-prompt-sets.controller';
import { EmailPromptSetsService } from './email-prompt-sets.service';

@Module({
  controllers: [EmailPromptSetsController],
  providers: [EmailPromptSetsService],
})
export class EmailPromptSetsModule {}
