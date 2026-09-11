import { Modal, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

interface ModalScreenProps {
  visible: boolean;
  onRequestClose: () => void;
  animationType?: 'none' | 'slide' | 'fade';
  onShow?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A full-screen modal that keeps its content clear of the notch, the Dynamic
 * Island and the home indicator.
 *
 * Uses `useSafeAreaInsets` and real padding rather than putting a `SafeAreaView`
 * inside the modal. `SafeAreaView` is a *native* view in this library, and a
 * React Native `Modal` is its own native window, so a safe-area view inside one
 * does not reliably pick up the device insets — which is exactly how a title
 * ends up underneath the clock. The hook reads the insets the root provider
 * already measured, and React context reaches into the modal even though the
 * native hierarchy does not.
 *
 * `statusBarTranslucent` makes Android draw under the status bar too, so the
 * same padding is correct on both platforms instead of double-counting on one.
 */
export function ModalScreen({
  visible,
  onRequestClose,
  animationType = 'slide',
  onShow,
  style,
  children,
}: ModalScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={onShow}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
          style,
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
