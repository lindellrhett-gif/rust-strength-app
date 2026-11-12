import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AchievementGrid } from '@/components/AchievementGrid';
import { BadgeShelf } from '@/components/BadgeShelf';
import { SectionHeader } from '@/components/SettingRow';
import { useMyLevel } from '@/data/level';
import { useProfile, useUpdateProfile } from '@/data/profile';
import {
  refreshFeatured,
  toggleFeatured,
  totalTiersAvailable,
  totalTiersEarned,
} from '@/domain/achievements';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/typography';

const BADGE_HELP = {
  title: 'Badges',
  body: 'Levelling up unlocks these. Influencer and Beta Tester are handed out by us and cannot be earned in the app.',
};

/** Your trophies and badges, opened from Profile. */
export default function TrophiesScreen() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const { badges, achievements, trophiesSettled } = useMyLevel();

  const stored = profile.data?.featured_trophies ?? [];
  const featured = trophiesSettled ? refreshFeatured(stored, achievements) : stored;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionHeader title="Badges" help={BADGE_HELP} />
          <BadgeShelf badges={badges} />
        </View>
        <View style={styles.section}>
          <SectionHeader
            title={`Trophies · ${totalTiersEarned(achievements)} of ${totalTiersAvailable(achievements)} tiers`}
          />
          <AchievementGrid
            achievements={achievements}
            featuredIds={featured.map((k) => k.split(':')[0])}
            onToggleFeatured={(a) =>
              update.mutate({ featured_trophies: toggleFeatured(featured, a) })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.md },
});
