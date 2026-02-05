import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmailsService } from './emails.service';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailsService: EmailsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('sent')
  listSent(@CurrentUser() user: { userId: string }) {
    return this.emailsService.listSentEmails(user.userId);
  }
}
