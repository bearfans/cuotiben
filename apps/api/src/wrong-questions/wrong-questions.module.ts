import { Module } from '@nestjs/common';
import { KnowledgePointsModule } from '../knowledge-points/knowledge-points.module';
import { StudentsModule } from '../students/students.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WrongQuestionsController } from './wrong-questions.controller';
import { WrongQuestionsService } from './wrong-questions.service';

@Module({
  imports: [StudentsModule, UploadsModule, KnowledgePointsModule],
  controllers: [WrongQuestionsController],
  providers: [WrongQuestionsService],
  exports: [WrongQuestionsService],
})
export class WrongQuestionsModule {}
