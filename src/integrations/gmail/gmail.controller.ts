import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Response } from 'express';
import { GmailService } from './gmail.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('integrations/gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @UseGuards(JwtAuthGuard)
  @Get('connect')
  connect(@CurrentUser() user: { userId: string }) {
    const url = this.gmailService.generateAuthUrl(user.userId);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Invalid OAuth callback');
    }
    await this.gmailService.handleOAuthCallback(code, state);
    const frontend = process.env.FRONTEND_URL;
    return res.redirect(`${frontend}/integrations/gmail/success`);
  }
}
