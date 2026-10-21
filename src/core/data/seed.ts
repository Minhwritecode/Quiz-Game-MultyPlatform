import type { QuestionSet } from '@/core/domain/models';

export const seedQuestionSets: QuestionSet[] = [
  {
    id: 'demo-react-native',
    title: 'React Native Foundations',
    subject: 'Mobile Development',
    updatedAt: '2026-10-17T08:00:00.000Z',
    syncStatus: 'synced',
    questions: [
      {
        id: 'rn-q-1',
        content: 'Which layer should own navigation and screen composition in Papyrus?',
        options: ['Presentation', 'Database', 'SQL RPC', 'OCR engine'],
        correctIndex: 0,
        explanation: 'Presentation owns screens and navigation while domain rules remain framework-free.',
        position: 0,
      },
      {
        id: 'rn-q-2',
        content: 'What is the purpose of an ordered sync outbox?',
        options: ['Preserve offline writes until they can be uploaded', 'Disable caching', 'Expose answer keys', 'Replace authentication'],
        correctIndex: 0,
        explanation: 'The outbox records local writes so sync can retry them safely when connectivity returns.',
        position: 1,
      },
    ],
  },
  {
    id: 'demo-architecture',
    title: 'Clean Architecture Quick Review',
    subject: 'Software Engineering',
    updatedAt: '2026-10-18T08:00:00.000Z',
    syncStatus: 'pending',
    questions: [
      {
        id: 'arch-q-1',
        content: 'Which direction should dependencies point in a clean architecture?',
        options: ['Toward domain abstractions', 'Toward UI widgets', 'Toward SQL tables only', 'Toward external providers'],
        correctIndex: 0,
        explanation: 'The domain defines stable contracts and outer layers implement them.',
        position: 0,
      },
    ],
  },
  {
    id: 'demo-product',
    title: 'Product Discovery Notes',
    subject: 'Product Design',
    updatedAt: '2026-10-19T08:00:00.000Z',
    syncStatus: 'synced',
    questions: [],
  },
];
