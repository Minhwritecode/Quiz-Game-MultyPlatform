export interface OptionShape {
  symbol: string;
  name: string;
  color: string;
  tint: string;
  border: string;
}

export const OPTION_SHAPES: OptionShape[] = [
  {
    symbol: '▲',
    name: 'Triangle',
    color: '#EF4444',
    tint: 'rgba(239, 68, 68, 0.15)',
    border: '#DC2626',
  },
  {
    symbol: '◆',
    name: 'Diamond',
    color: '#3B82F6',
    tint: 'rgba(59, 130, 246, 0.15)',
    border: '#2563EB',
  },
  {
    symbol: '●',
    name: 'Circle',
    color: '#F59E0B',
    tint: 'rgba(245, 158, 11, 0.15)',
    border: '#D97706',
  },
  {
    symbol: '■',
    name: 'Square',
    color: '#10B981',
    tint: 'rgba(16, 185, 129, 0.15)',
    border: '#059669',
  },
];

export function calculateSpeedPoints(isCorrect: boolean, elapsedSeconds: number, timeLimit = 20): number {
  if (!isCorrect) return 0;
  const fractionRemaining = Math.max(0, Math.min(1, 1 - elapsedSeconds / timeLimit));
  const MIN_POINTS = 500;
  const BASE_POINTS = 1000;
  return Math.round(MIN_POINTS + (BASE_POINTS - MIN_POINTS) * fractionRemaining);
}
