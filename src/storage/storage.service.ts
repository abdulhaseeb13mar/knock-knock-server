import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService {
  private readonly baseDir = join(process.cwd(), 'uploads', 'resumes');

  // Design choice: local disk storage keeps the interface simple and S3-ready later.
  async saveResume(buffer: Buffer, originalName: string) {
    await mkdir(this.baseDir, { recursive: true });
    const fileName = `${uuid()}-${originalName}`;
    const filePath = join(this.baseDir, fileName);
    await writeFile(filePath, buffer);
    return filePath;
  }
}
