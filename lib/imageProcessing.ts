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
 * Preserves original resolution - no upscaling or downscaling
 *
 * @param file - The image file to convert
 * @param backgroundColor - Background color for padding (hex color like '#FFFFFF' or 'transparent')
 * @returns A new File object with square aspect ratio at original resolution
 */
export const convertToSquare = async (
  file: File,
  backgroundColor: string = 'transparent'
): Promise<File> => {
  // 1. Load image
  const img = await loadImage(file);

  // 2. Determine dimensions - use original max dimension (no fixed resolution)
  const { width, height } = img;
  const maxDim = Math.max(width, height);

  // 3. Create square canvas using ORIGINAL dimensions (no upscaling)
  const canvas = document.createElement('canvas');
  canvas.width = maxDim;   // Use original max, NOT a fixed resolution
  canvas.height = maxDim;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // 4. Fill with background for letterboxing
  if (backgroundColor && backgroundColor !== 'transparent') {
    // Use specified background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, maxDim, maxDim);
  }
  // If backgroundColor is 'transparent', canvas starts with transparent pixels by default

  // 5. Calculate centering (NO SCALING - keep 100% original resolution)
  const x = (maxDim - width) / 2;
  const y = (maxDim - height) / 2;

  // 6. Draw image at original resolution with padding
  ctx.drawImage(img, x, y, width, height);

  // 7. Convert canvas to File
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
      1.0 // Max quality
    );
  });
};
