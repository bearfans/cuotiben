function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export default () => {
  const aiProvider = process.env.AI_PROVIDER?.toLowerCase() || (process.env.AI_API_KEY ? 'openai' : 'mock');
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: int(process.env.PORT, 3000),
    webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
    cookieSecure: bool(
      process.env.COOKIE_SECURE,
      (process.env.WEB_URL ?? '').startsWith('https://'),
    ),
    trustProxy: bool(process.env.TRUST_PROXY, false),
    corsOrigins: (process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    registrationInviteCode: process.env.REGISTRATION_INVITE_CODE ?? '',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '2h',
      refreshDays: int(process.env.JWT_REFRESH_DAYS, 30),
    },
    storage: {
      driver: (process.env.STORAGE_DRIVER ?? 'local').toLowerCase(),
      localDir: process.env.STORAGE_LOCAL_DIR ?? './storage',
      signingSecret: process.env.FILE_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev-file-secret-change-me',
      urlTtlSeconds: int(process.env.FILE_URL_TTL_SECONDS, 86400),
    },
    s3: {
      endPoint: process.env.S3_ENDPOINT ?? 'localhost',
      port: int(process.env.S3_PORT, 9000),
      useSSL: bool(process.env.S3_USE_SSL, false),
      accessKey: process.env.S3_ACCESS_KEY ?? 'myos',
      secretKey: process.env.S3_SECRET_KEY ?? 'myos-secret',
      bucket: process.env.S3_BUCKET ?? 'myos',
      region: process.env.S3_REGION ?? 'us-east-1',
    },
    ai: {
      provider: aiProvider,
      baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
      apiKey: process.env.AI_API_KEY ?? '',
      model: process.env.AI_MODEL ?? 'gpt-4o-mini',
      timeoutMs: int(process.env.AI_TIMEOUT_MS, 120000),
      maxRetries: int(process.env.AI_MAX_RETRIES, 1),
      jsonMode: bool(process.env.AI_JSON_MODE, true),
      dailyJobLimit: int(process.env.AI_DAILY_JOB_LIMIT, 50),
      promptVersion: process.env.AI_PROMPT_VERSION ?? 'v1',
      maxImageEdge: int(process.env.AI_MAX_IMAGE_EDGE, 1600),
    },
    queue: {
      enabled: bool(process.env.QUEUE_ENABLED, false),
      redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
      concurrency: int(process.env.AI_QUEUE_CONCURRENCY, 2),
    },
    pdf: {
      enabled: bool(process.env.PDF_ENABLED, true),
      chromiumExecutablePath: process.env.PDF_CHROMIUM_EXECUTABLE_PATH ?? '',
      signingSecret: process.env.PAPER_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev-paper-secret-change-me',
      tokenTtlSeconds: int(process.env.PAPER_TOKEN_TTL_SECONDS, 900),
    },
  };
};
