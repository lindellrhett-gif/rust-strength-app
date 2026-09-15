import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';

export default function AuthLayout() {
  const { session, recovering } = useAuth();
  // A reset code signs the user in before they have chosen a new password, so
  // hold them here until the reset screen says it is done.
  if (session && !recovering) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
