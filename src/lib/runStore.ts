import AsyncStorage from '@react-native-async-storage/async-storage';

import { createRunStore } from '@/domain/running/activeRunStore';

/**
 * The one run-in-progress store for the app. The GPS task writes to it, the
 * recording screen reads it, and both share this instance because they run in
 * the same JavaScript runtime, even when iOS wakes the app in the background.
 */
export const runStore = createRunStore(AsyncStorage);
