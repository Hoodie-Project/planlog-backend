import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Prisma 7 의 prisma-client 제너레이터는 드라이버 어댑터가 필수.
    // MySQL 은 mariadb 어댑터를 사용한다. (DATABASE_URL: mysql://user:pass@host:port/db)
    super({ adapter: new PrismaMariaDb(process.env.DATABASE_URL ?? '') });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
