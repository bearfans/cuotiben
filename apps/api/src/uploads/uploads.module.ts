import { Module } from '@nestjs/common';
import { FilesController, UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController, FilesController],
  providers: [StorageService, UploadsService],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
