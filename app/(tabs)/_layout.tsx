import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';

import { ConsentScreen } from '@/components/ConsentScreen';
import { useProfile } from '@/data/profile';
import { needsConsent } from '@/domain/consent';
import { TAB_TITLES } from '@/domain/tabs';
import { LEGAL } from '@/legal/config';
import { useAuth } from '@/providers/AuthProvider';
import { OnboardingProvider } from '@/providers/OnboardingProvider';
import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const { session } = useAuth();
  const profile = useProfile();
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  // Only once the profile has actually loaded: a slow or offline start must
  // not lock someone out of their own training while it is still unknown.
  if (profile.data) {
    const record = {
      termsVersion: profile.data.terms_version,
      ageConfirmedAt: profile.data.age_confirmed_at,
    };
    if (needsConsent(record, LEGAL.version)) return <ConsentScreen record={record} />;
  }

  // Wrapped here rather than at the root so the welcome cards can only appear
  // once someone is actually signed in, never over the sign-in screen.
  return (
    <OnboardingProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: TAB_TITLES.index,
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: TAB_TITLES.calendar,
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: TAB_TITLES.stats,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: TAB_TITLES.friends,
            tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: TAB_TITLES.profile,
            tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
          }}
        />
      </Tabs>
    </OnboardingProvider>
  );
}
