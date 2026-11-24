import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { PickedImageAsset } from '../types/app';
import type { PixelCropRect } from '../utils/imageCropUtils';

export const PUZZLE_EXPORT_SIZE = 1024;

export interface ImagePickResult {
  status: 'picked' | 'cancelled' | 'denied';
  asset?: PickedImageAsset;
}

/**
 * Requests media library permissions and opens the native photo gallery picker.
 * We intentionally keep `allowsEditing: false` so users always get our custom
 * interactive 1:1 cropper with live 3x3 / 4x4 / 5x5 tile cut-line previews.
 */
export async function pickImageFromGallery(): Promise<ImagePickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: 'denied' };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { status: 'cancelled' };
  }

  const selected = result.assets[0];
  return {
    status: 'picked',
    asset: {
      uri: selected.uri,
      width: selected.width,
      height: selected.height,
    },
  };
}

/**
 * Crops the picked image to an exact 1:1 square using the user's pan/zoom region,
 * optionally rotates in 90-degree increments, and normalizes output to 1024×1024 JPEG
 * so tiles stay razor-sharp while keeping Phase 3 cloud uploads lightweight (~150-300 KB).
 */
export async function cropAndNormalizeSquareImage(
  uri: string,
  cropRect: PixelCropRect,
  rotationDegrees: 0 | 90 | 180 | 270 = 0
): Promise<string> {
  const actions: ImageManipulator.Action[] = [
    {
      crop: {
        originX: cropRect.originX,
        originY: cropRect.originY,
        width: cropRect.width,
        height: cropRect.height,
      },
    },
  ];

  if (rotationDegrees !== 0) {
    actions.push({ rotate: rotationDegrees });
  }

  actions.push({
    resize: {
      width: PUZZLE_EXPORT_SIZE,
      height: PUZZLE_EXPORT_SIZE,
    },
  });

  const output = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.88,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return output.uri;
}
