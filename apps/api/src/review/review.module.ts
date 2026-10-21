import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { WrongQuestionsModule } from '../wrong-questions/wrong-questions.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [StudentsModule, WrongQuestionsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
