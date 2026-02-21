import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('keys')
  async getUserKeys(@CurrentUser() user: { userId: string }) {
    return this.aiService.getUserKeys(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('keys/:provider')
  async updateKey(
    @CurrentUser() user: { userId: string },
    @Param('provider') provider: string,
    @Body() dto: SaveKeyDto,
  ) {
    await this.aiService.updateApiKey(user.userId, provider as any, dto.apiKey);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('keys/:provider')
  async deleteKey(
    @CurrentUser() user: { userId: string },
    @Param('provider') provider: string,
  ) {
    return this.aiService.deleteApiKey(user.userId, provider as any);
  }
}
