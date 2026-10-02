import { Platform } from 'react-native';

const repo = Platform.OS === 'web'
  ? require('./recordingsRepo.web')
  : require('./recordingsRepo.native');

export const list = repo.list;
export const deleteRecording = repo.deleteRecording;
export const exportCsv = repo.exportCsv;
export const share = repo.share;
