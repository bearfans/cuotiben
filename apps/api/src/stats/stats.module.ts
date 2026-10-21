import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [StudentsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
