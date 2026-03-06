import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateEmailPromptSetDto } from './dto/create-email-prompt-set.dto';
import { UpdateEmailPromptSetDto } from './dto/update-email-prompt-set.dto';
import { EmailPromptSetsService } from './email-prompt-sets.service';

@Controller('email-prompt-sets')
export class EmailPromptSetsController {
  constructor(
    private readonly emailPromptSetsService: EmailPromptSetsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateEmailPromptSetDto,
  ) {
    return this.emailPromptSetsService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.emailPromptSetsService.findAll(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.emailPromptSetsService.findOne(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateEmailPromptSetDto,
  ) {
    return this.emailPromptSetsService.update(user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.emailPromptSetsService.remove(user.userId, id);
  }
}
