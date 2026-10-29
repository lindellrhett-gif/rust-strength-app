import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { FoodAmountSheet } from '@/components/nutrition/FoodAmountSheet';
import { NutritionLocked } from '@/components/nutrition/NutritionLocked';
import { useBarcodeFood, useLogEntries, useNutritionSettings } from '@/data/nutrition';
import { useAccess } from '@/data/subscription';
import { hasFeature } from '@/domain/entitlements';
import { mealNamesFor } from '@/domain/nutrition/diary';
import { entryFromFood, MAX_MEALS } from '@/domain/nutrition/entries';
import { canonicalBarcode } from '@/domain/nutrition/openFoodFacts';
import { DEFAULT_NUTRITION_SETTINGS } from '@/domain/nutrition/settings';
import { todayLocal } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

type CameraModule = typeof import('expo-camera');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPDATE_APP = 'This version of the app can’t scan barcodes yet. Update the app to get it.';

/** The barcodes on food packaging. */
const FOOD_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Scan a food's barcode, or type it in. Your own foods are checked first
 * (they work offline), then Open Food Facts. The camera module loads when
 * this screen opens, so an older build without it says to update instead of
 * failing to start; nothing from the camera is recorded or saved.
 */
export default function ScanScreen() {
  const access = useAccess();
  if (!hasFeature('nutrition', access)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.padded}>
          <NutritionLocked />
        </View>
      </SafeAreaView>
    );
  }
  return <Scanner />;
}

function Scanner() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string; meal?: string }>();
  const day = params.day && DAY_RE.test(params.day) ? params.day : todayLocal();
  const mealParam = Number(params.meal);
  const meal = Number.isInteger(mealParam) && mealParam >= 0 && mealParam < MAX_MEALS ? mealParam : 0;
  const settings = useNutritionSettings();
  const s = settings.data ?? DEFAULT_NUTRITION_SETTINGS;
  const { log } = useLogEntries();

  const [camera, setCamera] = useState<CameraModule | null>(null);
  const [cameraProblem, setCameraProblem] = useState<'missing' | 'denied' | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const lookup = useBarcodeFood(code);

  useEffect(() => {
    let live = true;
    import('expo-camera')
      .then(async (m) => {
        const current = await m.Camera.getCameraPermissionsAsync();
        const granted = current.granted || (current.canAskAgain && (await m.Camera.requestCameraPermissionsAsync()).granted);
        if (!live) return;
        if (granted) setCamera(m);
        else setCameraProblem('denied');
      })
      .catch(() => {
        if (live) setCameraProblem('missing');
      });
    return () => {
      live = false;
    };
  }, []);

  const CameraView = camera?.CameraView ?? null;
  const result = lookup.data;
  const found = result && 'food' in result ? result.food : null;
  const ownId = found?.id && found.source !== 'usda' ? found.id : null;
  const mealNames = mealNamesFor(s.mealNames, meal);

  return (
    <View style={styles.root}>
      {CameraView && !code ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODES] }}
          onBarcodeScanned={({ data }) => {
            const scanned = canonicalBarcode(data);
            if (scanned) setCode(scanned);
          }}
        />
      ) : null}

      <SafeAreaView style={styles.overlay}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" style={styles.closeButton}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        {!code ? (
          <View style={styles.middle}>
            {CameraView ? (
              <>
                <View style={styles.frame} />
                <Text style={styles.hint}>Point at the barcode on the package</Text>
              </>
            ) : (
              <Text style={styles.hint}>
                {cameraProblem === 'missing'
                  ? UPDATE_APP
                  : cameraProblem === 'denied'
                    ? 'The camera is off for Rust Strength. Turn it on in Settings, or type the barcode below.'
                    : 'Starting the camera…'}
              </Text>
            )}
            {cameraProblem === 'denied' ? (
              <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
            ) : null}
          </View>
        ) : (
          <View style={styles.middle}>
            {lookup.isLoading ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.hint}>Looking up {code}…</Text>
              </>
            ) : !found ? (
              <View style={styles.panel}>
                <Text style={text.heading}>{problemTitle(result)}</Text>
                <Text style={text.bodyMuted}>{problemDetail(result, code)}</Text>
                <Button
                  label="Create this food"
                  onPress={() => router.replace({ pathname: '/nutrition/food-edit', params: { barcode: code } })}
                />
                <Button label="Scan again" variant="secondary" onPress={() => setCode(null)} />
              </View>
            ) : null}
          </View>
        )}

        {!code ? (
          <View style={styles.bottom}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Or type the barcode"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={14}
              style={styles.input}
              accessibilityLabel="Barcode"
              onSubmitEditing={() => setCode(canonicalBarcode(typed))}
            />
            <Button
              label="Look up"
              variant="secondary"
              disabled={!canonicalBarcode(typed)}
              onPress={() => setCode(canonicalBarcode(typed))}
            />
          </View>
        ) : null}
      </SafeAreaView>

      {found ? (
        <FoodAmountSheet
          key={code ?? 'none'}
          visible
          food={found}
          meal={meal}
          mealNames={mealNames}
          energyUnit={s.energyUnit}
          netCarbs={s.netCarbs}
          onClose={() => setCode(null)}
          onEdit={ownId ? () => router.replace({ pathname: '/nutrition/food-edit', params: { id: ownId } }) : undefined}
          onSaveCopy={
            found.source === 'off' && code
              ? () => router.replace({ pathname: '/nutrition/food-edit', params: { barcode: code, from: 'off' } })
              : undefined
          }
          onAdd={({ amount, unitKey, meal: chosen }) => {
            const entry = entryFromFood(found, amount, unitKey, { id: newId(), day, meal: chosen, loggedAt: new Date().toISOString() });
            if (!entry) return;
            log([entry]);
            router.back();
          }}
        />
      ) : null}
    </View>
  );
}

type Result = ReturnType<typeof useBarcodeFood>['data'];

function problemTitle(result: Result): string {
  if (!result || 'food' in result) return 'Couldn’t look it up';
  switch (result.problem) {
    case 'offline':
      return 'No connection';
    case 'no_nutrition':
      return 'No nutrition listed';
    case 'not_found':
      return 'Not found';
    default:
      return 'Couldn’t look it up';
  }
}

function problemDetail(result: Result, code: string): string {
  if (!result || 'food' in result) return 'Try again in a minute, or add it yourself from the label.';
  switch (result.problem) {
    case 'offline':
      return `Looking up ${code} needs a connection. Foods you’ve created work offline.`;
    case 'no_nutrition':
      return `Open Food Facts knows ${code} but lists no nutrition for it. Add it from the label and it’s saved for next time.`;
    case 'not_found':
      return `${code} isn’t in Open Food Facts or your foods. Add it from the label and it’s saved for next time.`;
    default:
      return 'Open Food Facts didn’t answer. Try again in a minute, or add it from the label.';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.lg },
  overlay: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'flex-start', padding: spacing.lg },
  closeButton: { backgroundColor: 'rgba(11,13,16,0.7)', borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  close: { color: colors.text, fontWeight: '700', fontSize: 16 },
  middle: { alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  frame: { width: 260, height: 160, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.primary },
  hint: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  panel: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  bottom: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
});
