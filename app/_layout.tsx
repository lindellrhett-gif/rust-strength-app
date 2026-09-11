import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingView } from '@/components';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { registerMutationDefaults } from '@/data/mutationDefaults';
import { useProfile } from '@/data/profile';
import { CACHE_MAX_AGE, persister, queryClient } from '@/lib/queryClient';
import { startNetworkWatcher } from '@/lib/network';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { RestTimerProvider } from '@/providers/RestTimerProvider';
import { colors } from '@/theme/colors';

// Both run at import time, before anything renders. The queue is restored
// during the first paint, and a restored write has no function attached — so
// the defaults have to be registered before that happens or the write is
// dropped on the floor.
startNetworkWatcher();
registerMutationDefaults(queryClient);

/**
 * Expo Router installs an error boundary from a route file's `ErrorBoundary`
 * export. Exporting it from the root layout covers every screen beneath it, so
 * a render that throws shows a way out instead of a dead screen.
 */
export { AppErrorBoundary as ErrorBoundary };

/**
 * The rest timer lives above the navigator so it keeps counting while the user
 * moves between the workout screen and the add-set modal. It reads the user's
 * preferred duration here rather than inside the provider, which keeps the
 * provider itself free of data fetching.
 */
function RestTimerGate({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  return (
    <RestTimerProvider defaultSeconds={profile.data?.rest_seconds}>{children}</RestTimerProvider>
  );
}

function RootNavigator() {
  const { initializing } = useAuth();
  if (initializing) return <LoadingView label="Loading…" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* `(tabs)` owns "/" — its layout redirects to (auth) when signed out. */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="workout/[id]" options={{ headerShown: true, title: 'Workout' }} />
      <Stack.Screen name="friend/[id]" options={{ headerShown: true, title: 'Profile' }} />
      <Stack.Screen name="exercise/[id]" options={{ headerShown: true, title: 'Progress' }} />
      <Stack.Screen name="templates/index" options={{ headerShown: true, title: 'Presets' }} />
      <Stack.Screen name="templates/[id]" options={{ headerShown: true, title: 'Preset' }} />
      <Stack.Screen name="legal/privacy" options={{ headerShown: true, title: 'Privacy Policy' }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: true, title: 'Terms of Service' }} />
      <Stack.Screen
        name="legal/privacy-center"
        options={{ headerShown: true, title: 'Privacy & legal' }}
      />
      <Stack.Screen
        name="workout/summary"
        options={{ headerShown: true, title: 'Workout complete' }}
      />
      <Stack.Screen
        name="activity/new"
        options={{ headerShown: true, presentation: 'modal', title: 'Log activity' }}
      />
      <Stack.Screen
        name="generate"
        options={{ headerShown: true, presentation: 'modal', title: 'Generate workout' }}
      />
      <Stack.Screen
        name="set/new"
        options={{ headerShown: true, presentation: 'modal', title: 'Add set' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/*
          The cache is restored from the phone before anything renders, so the
          app opens with your training visible even with no signal — and any
          writes queued in a dead spot are picked back up here and replayed in
          the order they were made.
        */}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: CACHE_MAX_AGE,
            // Only writes waiting on a connection are worth storing. A write
            // that already landed, or one that failed outright, is not.
            dehydrateOptions: {
              shouldDehydrateMutation: (mutation) => mutation.state.isPaused,
            },
          }}
          onSuccess={() => {
            void queryClient.resumePausedMutations();
          }}
        >
          <AuthProvider>
            <StatusBar style="light" />
            <OfflineBanner />
            <RestTimerGate>
              <RootNavigator />
            </RestTimerGate>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
