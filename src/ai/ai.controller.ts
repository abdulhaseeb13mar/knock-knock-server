import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { SaveKeyDto } from './dto/save-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('key')
  async saveKey(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveKeyDto,
  ) {
    await this.aiService.saveApiKey(user.userId, dto.provider, dto.apiKey);
    return { success: true };
  }

  @Get('providers')
  listProviders() {
    return this.aiService.listProviders();
  }
}
