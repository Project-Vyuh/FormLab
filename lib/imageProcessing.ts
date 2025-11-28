/**
 * Image Processing Utilities
 *
 * Provides functions for converting images to square aspect ratio (1:1)
 * using padding/letterboxing to preserve the entire original image.
 */

/**
 * Load an image from a File object
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Get dimensions of an image file
 */
export const getImageDimensions = async (
  file: File
): Promise<{ width: number; height: number; aspectRatio: number }> => {
  const img = await loadImage(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    aspectRatio: img.naturalWidth / img.naturalHeight,
  };
};

/**
 * Convert an image to square aspect ratio (1:1) using padding/letterboxing
 *
 * @param file - The image file to convert
 * @param targetSize - Target size for both width and height (default: 2048)
 * @returns A new File object with square aspect ratio
 */
export const convertToSquare = async (
  file: File,
  targetSize: number = 2048
): Promise<File> => {
  // 1. Load image
  const img = await loadImage(file);

  // 2. Determine dimensions
  const { width, height } = img;
  const maxDim = Math.max(width, height);

  // 3. Create square canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 4. Fill with white background for letterboxing
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // 5. Calculate scaling to fit image within square
  const scale = targetSize / maxDim;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // 6. Center the image
  const x = (targetSize - scaledWidth) / 2;
  const y = (targetSize - scaledHeight) / 2;

  // 7. Draw image centered with padding
  ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

  // 8. Convert canvas to File
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const newFile = new File(
          [blob],
          file.name.replace(/\.[^.]+$/, '_square.png'),
          { type: 'image/png' }
        );
        resolve(newFile);
      },
      'image/png',
      0.95 // High quality PNG
    );
  });
};
