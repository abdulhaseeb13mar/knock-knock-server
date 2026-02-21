import {
  BadRequestException,
  Controller,
  Get,
  Post,
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

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@CurrentUser() user: { userId: string }) {
    const integrated = await this.gmailService.isConnected(user.userId);
    return { integrated };
  }

  @UseGuards(JwtAuthGuard)
  @Post('revoke')
  async revoke(@CurrentUser() user: { userId: string }) {
    await this.gmailService.revoke(user.userId);
    return { success: true };
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
