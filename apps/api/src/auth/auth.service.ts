import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthUser } from '../common/auth/auth-user';
import type { AuthResponse, User as PublicUser } from '@myos/shared';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens> {
    const inviteCode = this.config.get<string>('registrationInviteCode');
    if (inviteCode && dto.inviteCode !== inviteCode) {
      throw new ForbiddenException('邀请码不正确');
    }

    const username = dto.username.trim();
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException('该账号已被注册');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          passwordHash,
          displayName: dto.displayName?.trim() || username,
        },
      });
      if (dto.studentName?.trim()) {
        await tx.studentProfile.create({
          data: {
            userId: created.id,
            name: dto.studentName.trim(),
            grade: dto.grade ?? 1,
            semester: dto.semester ?? 'FIRST',
          },
        });
      }
      return created;
    });

    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username.trim() } });
    if (!user) throw new UnauthorizedException('账号或密码错误');
    if (user.status !== 'active') throw new ForbiddenException('账号已被停用');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('账号或密码错误');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user, meta);
  }

  async refresh(
    refreshToken: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
    if (existing.user.status !== 'active') throw new ForbiddenException('账号已被停用');

    const nextToken = randomBytes(48).toString('base64url');
    const nextHash = this.hashToken(nextToken);
    const expiresAt = this.refreshExpiry();

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenHash: nextHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextHash,
          expiresAt,
          userAgent: meta.userAgent,
          ip: meta.ip,
        },
      }),
    ]);

    return {
      accessToken: await this.signAccessToken(existing.user),
      refreshToken: nextToken,
      user: this.toPublicUser(existing.user),
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return this.toPublicUser(user);
  }

  async validateUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('登录已失效');
    return { id: user.id, username: user.username, displayName: user.displayName };
  }

  private async issueTokens(
    user: User,
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.refreshExpiry(),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, username: user.username });
  }

  private refreshExpiry(): Date {
    const days = this.config.get<number>('jwt.refreshDays') ?? 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
