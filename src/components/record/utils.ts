// ./src/components/record/utils.ts
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Generates a high-quality JPEG thumbnail from the captured native video file.
 */
export async function generateThumbnail(
  videoUri: string,
  recordedFacingMode: 'front' | 'back',
  time = 500,
): Promise<string> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time,
      quality: 0.8,
    });
    return uri;
  } catch (e) {
    console.warn('[Thumbnail Generation] Failed to generate thumbnail via expo-video-thumbnails:', e);
    throw e;
  }
}

/**
 * Generates a heavily compressed Low-Quality Image Placeholder (LQIP) to render during initial loading states.
 */
export async function generateBlurThumbnail(videoUri: string, recordedFacingMode: 'front' | 'back'): Promise<string> {
  try {
    const thumbUri = await generateThumbnail(videoUri, recordedFacingMode);
    const manipResult = await ImageManipulator.manipulateAsync(
      thumbUri,
      [{ resize: { width: 80, height: 142 } }],
      { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (e) {
    console.warn('[Blur Thumbnail Generation] Failed to generate blur thumbnail:', e);
    throw e;
  }
}

/**
 * Generates a heavily compressed Low-Quality Image Placeholder (LQIP) directly from a photo URI.
 */
export async function generateBlurThumbnailFromImage(imageUri: string): Promise<string> {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 80, height: 142 } }],
      { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (e) {
    console.warn('[Blur Thumbnail Generation] Failed from image:', e);
    return imageUri;
  }
}
