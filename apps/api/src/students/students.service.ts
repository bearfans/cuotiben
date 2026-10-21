import { Injectable, NotFoundException } from '@nestjs/common';
import type { StudentProfile } from '@prisma/client';
import type { Student } from '@myos/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Student[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });
    return students.map((student) => this.toDto(student));
  }

  async create(userId: string, dto: CreateStudentDto): Promise<Student> {
    const student = await this.prisma.studentProfile.create({
      data: {
        userId,
        name: dto.name.trim(),
        grade: dto.grade,
        semester: dto.semester ?? 'FIRST',
        avatarUrl: dto.avatarUrl,
      },
    });
    return this.toDto(student);
  }

  async update(userId: string, id: string, dto: UpdateStudentDto): Promise<Student> {
    await this.getOwned(userId, id);
    const student = await this.prisma.studentProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
        ...(dto.semester !== undefined ? { semester: dto.semester } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
    return this.toDto(student);
  }

  async archive(userId: string, id: string): Promise<{ success: boolean }> {
    await this.getOwned(userId, id);
    await this.prisma.studentProfile.update({
      where: { id },
      data: { isArchived: true },
    });
    return { success: true };
  }

  async getOwned(userId: string, id: string): Promise<StudentProfile> {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id, userId, isArchived: false },
    });
    if (!student) throw new NotFoundException('孩子档案不存在');
    return student;
  }

  async resolveStudent(userId: string, studentId?: string): Promise<StudentProfile> {
    if (studentId) return this.getOwned(userId, studentId);
    const student = await this.prisma.studentProfile.findFirst({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });
    if (!student) throw new NotFoundException('请先添加孩子档案');
    return student;
  }

  private toDto(student: StudentProfile): Student {
    return {
      id: student.id,
      name: student.name,
      grade: student.grade as Student['grade'],
      semester: student.semester,
      avatarUrl: student.avatarUrl,
      isArchived: student.isArchived,
      createdAt: student.createdAt.toISOString(),
    };
  }
}
