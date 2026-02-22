import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { SaveDriveResumeDto } from './dto/save-drive-resume.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('resumes/drive-link')
  async saveDriveResume(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveDriveResumeDto,
  ) {
    return this.usersService.saveDriveResume(user.userId, dto.sharedUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('resumes')
  listResumes(@CurrentUser() user: { userId: string }) {
    return this.usersService.listResumes(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('resumes/:id')
  async deleteResume(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    if (!id) {
      throw new BadRequestException('Resume id is required');
    }
    return this.usersService.deleteResume(user.userId, id);
  }
}
