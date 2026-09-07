import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingView } from '@/components';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';

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
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
