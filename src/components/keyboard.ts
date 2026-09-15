import type { ScrollViewProps } from 'react-native';

/**
 * Spread onto every ScrollView or FlatList that contains a text field.
 *
 * - `automaticallyAdjustKeyboardInsets` makes iOS inset the content by the
 *   keyboard's height and scroll the focused field into view, so the keyboard
 *   never sits on top of what you are typing. It follows the keyboard's real
 *   frame, which a fixed KeyboardAvoidingView offset cannot do inside modals,
 *   tab screens and stack headers.
 * - `interactive` dismissal lets you drag the keyboard away. The number pads
 *   used for weights and reps have no return key, so without this there is no
 *   way to put the keyboard down short of tapping a button.
 * - `handled` keeps a tap on a button working while the keyboard is up, instead
 *   of the first tap only closing the keyboard.
 */
export const keyboardAware = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardDismissMode: 'interactive',
  keyboardShouldPersistTaps: 'handled',
} as const satisfies ScrollViewProps;
