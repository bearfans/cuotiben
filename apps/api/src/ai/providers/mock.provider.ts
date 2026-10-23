import { Injectable } from '@nestjs/common';
import { SUBJECT_MAP, type AiRecognitionPayload } from '@myos/shared';
import type { AiProvider, AiRecognitionInput, AiRecognitionOutput } from '../ai.types';

@Injectable()
export class MockAiProvider implements AiProvider {
  async recognize(input: AiRecognitionInput): Promise<AiRecognitionOutput> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const subjectId = input.subjectHint ?? 'math';
    const subject = SUBJECT_MAP[subjectId]?.name ?? '数学';
    const payload: AiRecognitionPayload = {
      subject,
      imageQuality: 'GOOD',
      unreadableCount: 0,
      questions: [
        {
          questionType: 'SINGLE_CHOICE',
          stem: '解方程 $x^2-5x+6=0$，下列结果正确的是（ ）',
          options: [
            { label: 'A', content: '$x_1=2, x_2=3$' },
            { label: 'B', content: '$x_1=-2, x_2=-3$' },
            { label: 'C', content: '$x_1=1, x_2=6$' },
            { label: 'D', content: '$x_1=-1, x_2=-6$' },
          ],
          correctAnswer: 'A',
          studentAnswer: 'C',
          analysis: '将方程因式分解得 $(x-2)(x-3)=0$，所以 $x_1=2, x_2=3$。',
          knowledgePoints: ['一元二次方程', '因式分解'],
          difficulty: 3,
          errorReason: '因式分解时符号判断错误',
          isWrong: true,
          confidence: 0.93,
        },
        {
          questionType: 'FILL_BLANK',
          stem: '若 $a+b=5$，$ab=6$，则 $a^2+b^2=$ ______。',
          options: [],
          correctAnswer: '13',
          studentAnswer: '11',
          analysis: '$a^2+b^2=(a+b)^2-2ab=25-12=13$。',
          knowledgePoints: ['完全平方公式', '代数式求值'],
          difficulty: 3,
          errorReason: '完全平方公式展开时漏掉交叉项',
          isWrong: true,
          confidence: 0.88,
        },
      ],
    };
    return {
      payload,
      raw: payload,
      tokensIn: 0,
      tokensOut: 0,
      model: 'mock-vision',
    };
  }
}
