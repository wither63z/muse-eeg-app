import { Platform } from 'react-native';

type Repo = Pick<
  typeof import('./recordingsRepo.web'),
  'list' | 'deleteRecording' | 'exportCsv' | 'share'
>;
const repo: Repo =
  Platform.OS === 'web' ? require('./recordingsRepo.web') : require('./recordingsRepo.native');

export const list = repo.list;
export const deleteRecording = repo.deleteRecording;
export const exportCsv = repo.exportCsv;
export const share = repo.share;
