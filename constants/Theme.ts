import type { TextStyle } from 'react-native';

export const theme = {
  colors: {
    background: '#0C1017',
    surface: '#161B22',
    border: '#21262D',
    text: '#F0F6FC',
    secondaryText: '#8B949E',
    error: '#F85149',
    simulator: '#FF6D00',
    // Identidad del sistema (EEG)
    electrodes: {
      tp9: '#FF7B7B', // Delta
      af7: '#FFD180', // Theta
      af8: '#A8E6CF', // Alpha
      tp10: '#AEEFFF', // Beta
    },
    bands: {
      delta: '#FF7B7B',
      theta: '#FFD180',
      alpha: '#A8E6CF',
      beta: '#AEEFFF',
      gamma: '#E1BEE7',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
  },
  borderRadius: {
    pill: 20,
    pillMain: 24,
    card: 12,
    sm: 4,
    md: 8,
  },
  typography: {
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
};
