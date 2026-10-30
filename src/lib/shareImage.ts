/**
 * Turns a share card on screen into an image and hands it on: to the system
 * share sheet (Instagram, Messages, AirDrop and the rest) or to Photos.
 *
 * Nothing is uploaded. The image is made on the phone and goes only where
 * the person sends it. Saving asks for add-only access to Photos: the app can
 * put pictures in, never look at the ones already there.
 *
 * The native modules load on first use, not when the screen opens, so an
 * older build without them reports a clear error instead of failing to start.
 */
import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';

import { CARD_EXPORT } from '@/domain/shareCard';

const UPDATE_APP = 'This version of the app can’t share cards yet. Update the app to get it.';

/** The card as a 1080 x 1920 PNG in the app's temporary folder. */
export async function captureCard(ref: RefObject<View | null>): Promise<string> {
  const { captureRef } = await import('react-native-view-shot');
  // view-shot reads width and height in points and multiplies them by the
  // screen's scale, so passing pixels made a 3240 x 5760 image on a 3x phone.
  const scale = PixelRatio.get();
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    width: CARD_EXPORT.width / scale,
    height: CARD_EXPORT.height / scale,
    result: 'tmpfile',
  });
}

/** Opens the share sheet with the image. Resolves when it closes. */
export async function shareImage(uri: string): Promise<void> {
  const Sharing = await import('expo-sharing').catch(() => {
    throw new Error(UPDATE_APP);
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share' });
}

/** Saves the image to Photos, asking for add-only access the first time. */
export async function saveImageToPhotos(uri: string): Promise<void> {
  const MediaLibrary = await import('expo-media-library/legacy').catch(() => {
    throw new Error(UPDATE_APP);
  });
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Allow Rust Strength to add photos in Settings > Rust Strength > Photos, then try again.');
  }
  await MediaLibrary.saveToLibraryAsync(uri);
}
