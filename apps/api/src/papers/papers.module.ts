import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PaperPrintService } from './paper-print.service';
import { PaperPrintController, PapersController } from './papers.controller';
import { PapersService } from './papers.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [StudentsModule, UploadsModule],
  controllers: [PapersController, PaperPrintController],
  providers: [PapersService, PaperPrintService, PdfService],
  exports: [PapersService],
})
export class PapersModule {}
