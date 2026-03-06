import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailPromptSetDto } from './dto/create-email-prompt-set.dto';
import { UpdateEmailPromptSetDto } from './dto/update-email-prompt-set.dto';

@Injectable()
export class EmailPromptSetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateEmailPromptSetDto) {
    return this.prisma.emailPromptSet.create({
      data: {
        userId,
        emailFormat: dto.emailFormat,
        aiPrompt: dto.aiPrompt,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.emailPromptSet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const record = await this.prisma.emailPromptSet.findFirst({
      where: { id, userId },
    });

    if (!record) {
      throw new NotFoundException('Email prompt set not found');
    }

    return record;
  }

  async update(userId: string, id: string, dto: UpdateEmailPromptSetDto) {
    await this.findOne(userId, id);

    return this.prisma.emailPromptSet.update({
      where: { id },
      data: {
        emailFormat: dto.emailFormat,
        aiPrompt: dto.aiPrompt,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.emailPromptSet.delete({
      where: { id },
    });

    return { success: true };
  }
}
