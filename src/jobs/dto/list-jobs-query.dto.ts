import { IsEnum, IsOptional } from 'class-validator';
import { JobStatus } from '@prisma/client';

export class ListJobsQueryDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
}
