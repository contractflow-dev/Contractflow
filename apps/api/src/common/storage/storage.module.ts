import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readObjectStorageConfig } from './object-storage.config';
import { OBJECT_STORAGE } from './object-storage.interface';
import { createS3Client, S3ObjectStorage } from './s3-object-storage';

/** Provides the application's single object storage client. */
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const storageConfig = readObjectStorageConfig(config);
        return new S3ObjectStorage(
          createS3Client(storageConfig),
          storageConfig,
        );
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
