import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SUBJECTS, normalizeKnowledgePoint } from '@myos/shared';

const prisma = new PrismaClient();

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_STUDENT_1 = '00000000-0000-4000-8000-000000000101';
const DEMO_STUDENT_2 = '00000000-0000-4000-8000-000000000102';

const KNOWLEDGE_SEEDS: Record<string, string[]> = {
  chinese: ['字音字形', '词语运用', '病句修改', '古诗文默写', '阅读理解', '作文立意'],
  math: [
    '整数运算',
    '分数与小数',
    '方程与不等式',
    '平面图形',
    '三角形',
    '一次函数',
    '二次函数',
    '概率与统计',
  ],
  english: ['一般现在时', '一般过去时', '名词单复数', '介词搭配', '阅读理解', '书面表达'],
  physics: ['力与运动', '压强', '浮力', '简单电路', '欧姆定律', '光的反射'],
  chemistry: ['化学式与化合价', '质量守恒定律', '酸碱盐', '金属活动性'],
  biology: ['细胞结构', '人体消化系统', '生态系统', '遗传与变异'],
  history: ['中国古代史', '近代史', '世界史'],
  geography: ['地球与地图', '气候类型', '中国地理'],
  morality: ['法律常识', '道德修养'],
  politics: ['经济生活', '政治生活'],
  science: ['物质科学', '生命科学'],
  other: ['综合应用'],
};

interface SeedQuestion {
  id: string;
  studentId: string;
  subjectId: string;
  grade: number;
  semester: 'FIRST' | 'SECOND';
  questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'OTHER';
  stem: string;
  options?: { label: string; content: string }[];
  correctAnswer: string;
  studentAnswer?: string;
  analysis?: string;
  errorReason?: string;
  difficulty: number;
  mastery: number;
  reviewCount: number;
  intervalDays: number;
  nextReviewOffsetDays: number;
  knowledgePoints: string[];
}

const QUESTIONS: SeedQuestion[] = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    studentId: DEMO_STUDENT_1,
    subjectId: 'math',
    grade: 5,
    semester: 'FIRST',
    questionType: 'SINGLE_CHOICE',
    stem: '一个数的 $\\frac{3}{5}$ 是 24，这个数是多少？',
    options: [
      { label: 'A', content: '30' },
      { label: 'B', content: '40' },
      { label: 'C', content: '45' },
      { label: 'D', content: '60' },
    ],
    correctAnswer: 'B',
    studentAnswer: 'A',
    analysis: '设这个数为 $x$，则 $\\frac{3}{5}x=24$，解得 $x=24\\div\\frac{3}{5}=40$。',
    errorReason: '把除法看成了乘法，用 $24\\times\\frac{3}{5}$ 计算。',
    difficulty: 3,
    mastery: 1,
    reviewCount: 2,
    intervalDays: 2,
    nextReviewOffsetDays: 0,
    knowledgePoints: ['分数与小数'],
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    studentId: DEMO_STUDENT_1,
    subjectId: 'math',
    grade: 5,
    semester: 'FIRST',
    questionType: 'FILL_BLANK',
    stem: '计算：$12.5\\times 8 - 3.6\\div 0.4 =$ ______。',
    correctAnswer: '91',
    studentAnswer: '91',
    analysis: '$12.5\\times 8=100$，$3.6\\div 0.4=9$，所以 $100-9=91$。',
    difficulty: 2,
    mastery: 4,
    reviewCount: 4,
    intervalDays: 7,
    nextReviewOffsetDays: 2,
    knowledgePoints: ['分数与小数', '整数运算'],
  },
  {
    id: '00000000-0000-4000-8000-000000001003',
    studentId: DEMO_STUDENT_1,
    subjectId: 'math',
    grade: 5,
    semester: 'FIRST',
    questionType: 'SHORT_ANSWER',
    stem: '一个长方形操场，长是 60 米，宽是 40 米。小明沿操场跑了两圈，一共跑了多少米？',
    correctAnswer: '400 米',
    studentAnswer: '200 米',
    analysis: '长方形周长 $=(60+40)\\times 2=200$ 米，两圈为 $200\\times 2=400$ 米。',
    errorReason: '只算了一圈的周长，忘记乘 2。',
    difficulty: 3,
    mastery: 2,
    reviewCount: 1,
    intervalDays: 1,
    nextReviewOffsetDays: -1,
    knowledgePoints: ['平面图形'],
  },
  {
    id: '00000000-0000-4000-8000-000000001004',
    studentId: DEMO_STUDENT_1,
    subjectId: 'chinese',
    grade: 5,
    semester: 'FIRST',
    questionType: 'SINGLE_CHOICE',
    stem: '下列词语中，没有错别字的一项是（　　）。',
    options: [
      { label: 'A', content: '迫不急待' },
      { label: 'B', content: '再接再厉' },
      { label: 'C', content: '一如继往' },
      { label: 'D', content: '谈笑风声' },
    ],
    correctAnswer: 'B',
    studentAnswer: 'C',
    analysis: 'A 应为“迫不及待”，C 应为“一如既往”，D 应为“谈笑风生”。',
    errorReason: '对形近字辨析不准确。',
    difficulty: 2,
    mastery: 3,
    reviewCount: 3,
    intervalDays: 4,
    nextReviewOffsetDays: 0,
    knowledgePoints: ['字音字形', '词语运用'],
  },
  {
    id: '00000000-0000-4000-8000-000000001005',
    studentId: DEMO_STUDENT_1,
    subjectId: 'chinese',
    grade: 5,
    semester: 'FIRST',
    questionType: 'FILL_BLANK',
    stem: '补写诗句：欲穷千里目，______。',
    correctAnswer: '更上一层楼',
    studentAnswer: '更上一层楼',
    analysis: '出自王之涣《登鹳雀楼》。',
    difficulty: 1,
    mastery: 5,
    reviewCount: 5,
    intervalDays: 15,
    nextReviewOffsetDays: 10,
    knowledgePoints: ['古诗文默写'],
  },
  {
    id: '00000000-0000-4000-8000-000000001006',
    studentId: DEMO_STUDENT_1,
    subjectId: 'english',
    grade: 5,
    semester: 'FIRST',
    questionType: 'SINGLE_CHOICE',
    stem: 'She ______ to school by bike every day.',
    options: [
      { label: 'A', content: 'go' },
      { label: 'B', content: 'goes' },
      { label: 'C', content: 'going' },
      { label: 'D', content: 'went' },
    ],
    correctAnswer: 'B',
    studentAnswer: 'A',
    analysis: '主语 She 是第三人称单数，一般现在时动词用 goes。',
    errorReason: '没有注意主语是第三人称单数。',
    difficulty: 2,
    mastery: 2,
    reviewCount: 2,
    intervalDays: 2,
    nextReviewOffsetDays: 0,
    knowledgePoints: ['一般现在时'],
  },
  {
    id: '00000000-0000-4000-8000-000000001007',
    studentId: DEMO_STUDENT_1,
    subjectId: 'english',
    grade: 5,
    semester: 'FIRST',
    questionType: 'TRUE_FALSE',
    stem: '“There are some apples in the basket.” 中 apples 是可数名词复数。',
    correctAnswer: '正确',
    studentAnswer: '错误',
    analysis: 'apple 是可数名词，some 后接可数名词复数 apples。',
    difficulty: 2,
    mastery: 3,
    reviewCount: 1,
    intervalDays: 4,
    nextReviewOffsetDays: 3,
    knowledgePoints: ['名词单复数'],
  },
  {
    id: '00000000-0000-4000-8000-000000001008',
    studentId: DEMO_STUDENT_1,
    subjectId: 'science',
    grade: 5,
    semester: 'FIRST',
    questionType: 'SHORT_ANSWER',
    stem: '为什么夏天刚从游泳池出来时会感觉冷？请用蒸发的知识解释。',
    correctAnswer:
      '身上的水蒸发时需要吸收热量，蒸发吸热会使皮肤温度降低，所以感觉冷。',
    studentAnswer: '因为外面有风。',
    analysis: '水蒸发是汽化现象，汽化吸热，因此会带走身体表面的热量。',
    errorReason: '没有抓住“蒸发吸热”这一关键知识点。',
    difficulty: 3,
    mastery: 1,
    reviewCount: 0,
    intervalDays: 1,
    nextReviewOffsetDays: 0,
    knowledgePoints: ['物质科学'],
  },
  {
    id: '00000000-0000-4000-8000-000000001009',
    studentId: DEMO_STUDENT_2,
    subjectId: 'physics',
    grade: 8,
    semester: 'FIRST',
    questionType: 'SINGLE_CHOICE',
    stem: '一个物体浸没在水中，排开水的体积为 $200\\,\\text{cm}^3$，它受到的浮力约为（　　）。',
    options: [
      { label: 'A', content: '0.2 N' },
      { label: 'B', content: '2 N' },
      { label: 'C', content: '20 N' },
      { label: 'D', content: '200 N' },
    ],
    correctAnswer: 'B',
    studentAnswer: 'A',
    analysis:
      '$F_\\text{浮}=\\rho_\\text{水}gV_\\text{排}=1.0\\times10^3\\times10\\times200\\times10^{-6}=2\\,\\text{N}$。',
    errorReason: '体积单位换算错误，把 $200\\,\\text{cm}^3$ 当成了 $0.02\\,\\text{m}^3$。',
    difficulty: 3,
    mastery: 2,
    reviewCount: 1,
    intervalDays: 2,
    nextReviewOffsetDays: 0,
    knowledgePoints: ['浮力'],
  },
  {
    id: '00000000-0000-4000-8000-000000001010',
    studentId: DEMO_STUDENT_2,
    subjectId: 'math',
    grade: 8,
    semester: 'FIRST',
    questionType: 'SHORT_ANSWER',
    stem: '解方程：$\\frac{x-1}{2}-\\frac{2x+1}{3}=1$。',
    correctAnswer: '$x=-11$',
    studentAnswer: '$x=1$',
    analysis:
      '两边同乘 6：$3(x-1)-2(2x+1)=6$，$3x-3-4x-2=6$，$-x=11$，所以 $x=-11$。',
    errorReason: '去分母时右边的 1 忘记乘 6。',
    difficulty: 4,
    mastery: 1,
    reviewCount: 2,
    intervalDays: 2,
    nextReviewOffsetDays: -2,
    knowledgePoints: ['方程与不等式'],
  },
  {
    id: '00000000-0000-4000-8000-000000001011',
    studentId: DEMO_STUDENT_2,
    subjectId: 'physics',
    grade: 8,
    semester: 'FIRST',
    questionType: 'TRUE_FALSE',
    stem: '物体运动状态改变时，一定受到了力的作用。',
    correctAnswer: '正确',
    studentAnswer: '正确',
    analysis: '力是改变物体运动状态的原因，运动状态改变说明受到非平衡力。',
    difficulty: 2,
    mastery: 4,
    reviewCount: 3,
    intervalDays: 7,
    nextReviewOffsetDays: 5,
    knowledgePoints: ['力与运动'],
  },
  {
    id: '00000000-0000-4000-8000-000000001012',
    studentId: DEMO_STUDENT_2,
    subjectId: 'english',
    grade: 8,
    semester: 'FIRST',
    questionType: 'FILL_BLANK',
    stem: 'He ______ (visit) his grandparents last weekend.',
    correctAnswer: 'visited',
    studentAnswer: 'visits',
    analysis: 'last weekend 表示一般过去时，visit 的过去式为 visited。',
    errorReason: '忽略时间状语，误用一般现在时。',
    difficulty: 2,
    mastery: 3,
    reviewCount: 2,
    intervalDays: 4,
    nextReviewOffsetDays: 1,
    knowledgePoints: ['一般过去时'],
  },
];

async function main(): Promise<void> {
  console.log('Seeding subjects...');
  for (const subject of SUBJECTS) {
    await prisma.subject.upsert({
      where: { id: subject.id },
      update: {
        name: subject.name,
        shortName: subject.shortName,
        stages: subject.stages,
        color: subject.color,
        sortOrder: subject.sortOrder,
      },
      create: {
        id: subject.id,
        name: subject.name,
        shortName: subject.shortName,
        stages: subject.stages,
        color: subject.color,
        sortOrder: subject.sortOrder,
      },
    });
  }

  console.log('Seeding knowledge points...');
  const kpMap = new Map<string, string>();
  for (const [subjectId, names] of Object.entries(KNOWLEDGE_SEEDS)) {
    for (const name of names) {
      const normalizedName = normalizeKnowledgePoint(name);
      const kp = await prisma.knowledgePoint.upsert({
        where: { subjectId_normalizedName: { subjectId, normalizedName } },
        update: { name },
        create: {
          subjectId,
          name,
          normalizedName,
          createdBy: 'SEED',
        },
      });
      kpMap.set(`${subjectId}:${name}`, kp.id);
    }
  }

  console.log('Seeding demo user...');
  const passwordHash = await bcrypt.hash('demo12345', 10);
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { displayName: '演示家长', passwordHash },
    create: {
      id: DEMO_USER_ID,
      username: 'demo',
      passwordHash,
      displayName: '演示家长',
    },
  });

  console.log('Seeding students...');
  await prisma.studentProfile.upsert({
    where: { id: DEMO_STUDENT_1 },
    update: { name: '小明', grade: 5, semester: 'FIRST' },
    create: {
      id: DEMO_STUDENT_1,
      userId: DEMO_USER_ID,
      name: '小明',
      grade: 5,
      semester: 'FIRST',
    },
  });
  await prisma.studentProfile.upsert({
    where: { id: DEMO_STUDENT_2 },
    update: { name: '小雨', grade: 8, semester: 'FIRST' },
    create: {
      id: DEMO_STUDENT_2,
      userId: DEMO_USER_ID,
      name: '小雨',
      grade: 8,
      semester: 'FIRST',
    },
  });

  console.log('Seeding wrong questions...');
  const now = Date.now();
  for (const question of QUESTIONS) {
    const nextReviewAt = new Date(now + question.nextReviewOffsetDays * 86_400_000);
    const data: Prisma.WrongQuestionUncheckedCreateInput = {
      id: question.id,
      userId: DEMO_USER_ID,
      studentId: question.studentId,
      subjectId: question.subjectId,
      grade: question.grade,
      semester: question.semester,
      questionType: question.questionType,
      stem: question.stem,
      options: question.options as unknown as Prisma.InputJsonValue,
      correctAnswer: question.correctAnswer,
      studentAnswer: question.studentAnswer ?? null,
      analysis: question.analysis ?? null,
      errorReason: question.errorReason ?? null,
      difficulty: question.difficulty,
      mastery: question.mastery,
      source: 'MANUAL',
      reviewCount: question.reviewCount,
      intervalDays: question.intervalDays,
      nextReviewAt,
      lastReviewedAt:
        question.reviewCount > 0
          ? new Date(now - Math.max(1, question.intervalDays) * 86_400_000)
          : null,
    };
    await prisma.wrongQuestion.upsert({
      where: { id: question.id },
      update: {
        stem: question.stem,
        mastery: question.mastery,
        nextReviewAt,
        intervalDays: question.intervalDays,
        reviewCount: question.reviewCount,
      },
      create: data,
    });

    await prisma.wrongQuestionKnowledgePoint.deleteMany({
      where: { wrongQuestionId: question.id },
    });
    await prisma.wrongQuestionKnowledgePoint.createMany({
      data: question.knowledgePoints
        .map((name) => kpMap.get(`${question.subjectId}:${name}`))
        .filter((id): id is string => Boolean(id))
        .map((knowledgePointId, index) => ({
          wrongQuestionId: question.id,
          knowledgePointId,
          isPrimary: index === 0,
          confidence: 0.9,
        })),
    });
  }

  console.log('Recalculating knowledge point usage...');
  const usage = await prisma.wrongQuestionKnowledgePoint.groupBy({
    by: ['knowledgePointId'],
    _count: { _all: true },
  });
  await prisma.knowledgePoint.updateMany({ data: { usageCount: 0 } });
  for (const row of usage) {
    await prisma.knowledgePoint.update({
      where: { id: row.knowledgePointId },
      data: { usageCount: row._count._all },
    });
  }

  console.log('Seeding review history...');
  const reviewSeed = [
    { id: '00000000-0000-4000-8000-000000002001', questionId: QUESTIONS[1].id, daysAgo: 6, rating: 'GOOD' as const },
    { id: '00000000-0000-4000-8000-000000002002', questionId: QUESTIONS[4].id, daysAgo: 5, rating: 'EASY' as const },
    { id: '00000000-0000-4000-8000-000000002003', questionId: QUESTIONS[3].id, daysAgo: 3, rating: 'HARD' as const },
    { id: '00000000-0000-4000-8000-000000002004', questionId: QUESTIONS[0].id, daysAgo: 2, rating: 'AGAIN' as const },
    { id: '00000000-0000-4000-8000-000000002005', questionId: QUESTIONS[10].id, daysAgo: 1, rating: 'GOOD' as const },
  ];
  for (const log of reviewSeed) {
    const completedAt = new Date(now - log.daysAgo * 86_400_000);
    await prisma.reviewLog.upsert({
      where: { id: log.id },
      update: {},
      create: {
        id: log.id,
        userId: DEMO_USER_ID,
        wrongQuestionId: log.questionId,
        rating: log.rating,
        scheduledAt: completedAt,
        completedAt,
        intervalBefore: 1,
        intervalAfter: 4,
        masteryBefore: 2,
        masteryAfter: 3,
      },
    });
  }

  console.log('Seeding demo paper...');
  const demoPaperId = '00000000-0000-4000-8000-000000003001';
  const paperQuestionIds = [
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001004',
    '00000000-0000-4000-8000-000000001006',
    '00000000-0000-4000-8000-000000001007',
    '00000000-0000-4000-8000-000000001005',
    '00000000-0000-4000-8000-000000001003',
  ];
  const paperQuestions = await prisma.wrongQuestion.findMany({
    where: { id: { in: paperQuestionIds } },
    include: {
      subject: true,
      knowledgePoints: { include: { knowledgePoint: true } },
    },
  });
  const byQuestionId = new Map(paperQuestions.map((question) => [question.id, question]));
  const sectionFor = (type: string): string => {
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') return 'CHOICE';
    if (type === 'TRUE_FALSE') return 'TRUE_FALSE';
    if (type === 'FILL_BLANK') return 'FILL_BLANK';
    if (type === 'SHORT_ANSWER') return 'SHORT_ANSWER';
    return 'OTHER';
  };
  const sectionOrder = ['CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'OTHER'];
  const paperItems = paperQuestionIds
    .map((id) => byQuestionId.get(id))
    .filter((question): question is NonNullable<typeof question> => Boolean(question))
    .sort(
      (a, b) =>
        sectionOrder.indexOf(sectionFor(a.questionType)) -
        sectionOrder.indexOf(sectionFor(b.questionType)),
    )
    .map((question, index) => ({
      wrongQuestionId: question.id,
      sortOrder: index,
      section: sectionFor(question.questionType),
      snapshot: {
        questionId: question.id,
        subjectId: question.subjectId,
        subjectName: question.subject.name,
        grade: question.grade,
        semester: question.semester,
        questionType: question.questionType,
        stem: question.stem,
        options: question.options,
        correctAnswer: question.correctAnswer,
        studentAnswer: question.studentAnswer,
        analysis: question.analysis,
        knowledgePoints: question.knowledgePoints.map((link) => link.knowledgePoint.name),
        difficulty: question.difficulty,
        images: [],
      } as Prisma.InputJsonValue,
    }));
  const paperSettings = {
    includeAnswers: true,
    includeKnowledgePoints: true,
    includeStudentAnswer: false,
    showScore: true,
  };
  await prisma.paper.upsert({
    where: { id: demoPaperId },
    update: {
      title: '小明的错题重练卷',
      questionCount: paperItems.length,
      settings: paperSettings,
      pdfKey: null,
      deletedAt: null,
      items: { deleteMany: {}, create: paperItems },
    },
    create: {
      id: demoPaperId,
      userId: DEMO_USER_ID,
      studentId: DEMO_STUDENT_1,
      subjectId: null,
      title: '小明的错题重练卷',
      grade: 5,
      questionCount: paperItems.length,
      settings: paperSettings,
      items: { create: paperItems },
    },
  });

  console.log('Seed completed.');
  console.log('Demo account: demo / demo12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
