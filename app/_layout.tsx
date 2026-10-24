import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import * as recordingsRepo from '@/recording/recordingsRepo';
import { useMuseStore } from '@/store/useMuseStore';

import { RecordingMeta } from '@/types/muse';

export default function RootLayout() {
  useEffect(() => {
    recordingsRepo
      .list()
      .then((recordings: RecordingMeta[]) => {
        useMuseStore.getState().setRecordings(recordings);
      })
      .catch((error) =>
        useMuseStore
          .getState()
          .setStatus(
            'error',
            error instanceof Error ? error.message : 'No se pudieron abrir las grabaciones.',
          ),
      );
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </GestureHandlerRootView>
  );
}
