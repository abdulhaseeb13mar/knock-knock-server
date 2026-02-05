import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';

@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CommonModule {}
