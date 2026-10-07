import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { useSaveRun } from '@/data/runs';
import { lastRecordedBefore, recoveryFor, UNSAVABLE_MESSAGE } from '@/domain/running/finish';
import { discardActiveRun, finishActiveRun } from '@/lib/activeRun';
import { LAUNCHED_AT } from '@/lib/runTracker';
import { runStore } from '@/lib/runStore';
import { useAuth } from '@/providers/AuthProvider';

/** Asked once per launch at most, however often the tabs remount. */
let checkedThisLaunch = false;

/**
 * When the app opens and finds a run still on the phone (it closed mid-run,
 * or before a finished run was saved), asks what to do with it: carry on,
 * finish and save it, or discard it. Renders nothing.
 *
 * Waits until the app is actually on screen: iOS can start the app in the
 * background, and a question nobody sees would be answered by nobody.
 */
export function RunRecovery() {
  const router = useRouter();
  const { userId } = useAuth();
  const { mutate: saveRun } = useSaveRun();

  useEffect(() => {
    if (!userId || checkedThisLaunch) return;

    const finishAndSave = async (finishAt: number) => {
      const outcome = await finishActiveRun(finishAt);
      if (!outcome) return;
      if (outcome.kind !== 'ready') {
        Alert.alert('Too short to save', UNSAVABLE_MESSAGE[outcome.kind], [
          { text: 'Discard run', style: 'destructive', onPress: () => void discardActiveRun(outcome.runId) },
        ]);
        return;
      }
      saveRun(outcome.input);
      router.push(`/run/${outcome.runId}`);
    };

    const confirmDiscard = (runId: string, onCancel: () => void) =>
      Alert.alert('Discard this run?', 'Its route and time will be deleted from this phone.', [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Discard', style: 'destructive', onPress: () => void discardActiveRun(runId) },
      ]);

    const check = async () => {
      if (checkedThisLaunch || AppState.currentState !== 'active') return;
      checkedThisLaunch = true;
      const run = await runStore.load();
      if (!run) return;
      const runId = run.meta.runId;

      switch (recoveryFor(run, userId)) {
        case 'discard':
          await discardActiveRun(runId);
          return;
        case 'resume': {
          const ask = () =>
            Alert.alert(
              'Run in progress',
              'Rust Strength closed while you were recording. Pick up where you left off, or finish the run now.',
              [
                { text: 'Resume', onPress: () => router.push('/run/record') },
                {
                  text: 'Finish and save',
                  onPress: () => void finishAndSave(lastRecordedBefore(run, LAUNCHED_AT)),
                },
                { text: 'Discard', style: 'destructive', onPress: () => confirmDiscard(runId, ask) },
              ],
              { cancelable: false },
            );
          ask();
          return;
        }
        case 'save': {
          const ask = () =>
            Alert.alert(
              'Unsaved run',
              'You finished a run that hasn’t been saved yet.',
              [
                {
                  text: 'Save run',
                  onPress: () => void finishAndSave(run.meta.recorder.finishedAt ?? Date.now()),
                },
                { text: 'Discard', style: 'destructive', onPress: () => confirmDiscard(runId, ask) },
              ],
              { cancelable: false },
            );
          ask();
          return;
        }
        case 'none':
          return;
      }
    };

    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [userId, router, saveRun]);

  return null;
}
