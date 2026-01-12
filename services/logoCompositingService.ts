/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CompositeLogoOptions {
    sourceImageUrl: string;
    logoUrl: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: 'small' | 'medium' | 'large';
    opacity: number;
    offsetX: number; // -20 to +20 percentage
    offsetY: number; // -20 to +20 percentage
}

/**
 * Load an image from URL
 * Handles CORS and returns HTMLImageElement
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

/**
 * Composite logo onto image at download time
 * Returns blob ready for download
 * 
 * @param options - Compositing configuration
 * @returns Blob containing composited image
 */
export async function compositeLogoOnImage(
    options: CompositeLogoOptions
): Promise<Blob> {
    const { sourceImageUrl, logoUrl, position, size, opacity, offsetX = 0, offsetY = 0 } = options;

    console.log('[logoCompositingService] Starting logo compositing:', {
        position,
        size,
        opacity
    });

    try {
        // Load images in parallel
        const [sourceImg, logoImg] = await Promise.all([
            loadImage(sourceImageUrl),
            loadImage(logoUrl)
        ]);

        console.log('[logoCompositingService] Images loaded:', {
            sourceSize: `${sourceImg.width}x${sourceImg.height}`,
            logoSize: `${logoImg.width}x${logoImg.height}`
        });

        // Create canvas with source image dimensions
        const canvas = document.createElement('canvas');
        canvas.width = sourceImg.width;
        canvas.height = sourceImg.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Draw source image
        ctx.drawImage(sourceImg, 0, 0);

        // Calculate logo dimensions (percentage of canvas width - matches preview overlay)
        const sizeMap = {
            small: 0.10,   // 10%
            medium: 0.15,  // 15%
            large: 0.22    // 22%
        };
        const logoMaxSize = canvas.width * sizeMap[size];
        const basePadding = canvas.width * 0.02; // 2% base padding

        // Calculate actual logo dimensions preserving aspect ratio
        const logoAspectRatio = logoImg.width / logoImg.height;
        let logoWidth: number, logoHeight: number;

        if (logoAspectRatio >= 1) {
            // Landscape logo: width is the constraint
            logoWidth = logoMaxSize;
            logoHeight = logoMaxSize / logoAspectRatio;
        } else {
            // Portrait logo: height is the constraint
            logoHeight = logoMaxSize;
            logoWidth = logoMaxSize * logoAspectRatio;
        }

        // Calculate offset in pixels (percentage of image dimensions)
        const offsetXPx = (offsetX / 100) * canvas.width;
        const offsetYPx = (offsetY / 100) * canvas.height;

        // Determine offset direction based on position
        const isRightAligned = position.includes('right');
        const isBottomAligned = position.includes('bottom');
        const adjustedOffsetX = isRightAligned ? -offsetXPx : offsetXPx;
        const adjustedOffsetY = isBottomAligned ? -offsetYPx : offsetYPx;

        // Calculate position coordinates (using logoWidth/logoHeight for proper positioning)
        const positions = {
            'top-left': {
                x: basePadding,
                y: basePadding
            },
            'top-right': {
                x: canvas.width - logoWidth - basePadding,
                y: basePadding
            },
            'bottom-left': {
                x: basePadding,
                y: canvas.height - logoHeight - basePadding
            },
            'bottom-right': {
                x: canvas.width - logoWidth - basePadding,
                y: canvas.height - logoHeight - basePadding
            },
        };

        const basePos = positions[position];
        const rawX = basePos.x + adjustedOffsetX;
        const rawY = basePos.y + adjustedOffsetY;

        // CLAMP to valid bounds - logo must stay fully within image (matches preview behavior)
        const x = Math.max(0, Math.min(rawX, canvas.width - logoWidth));
        const y = Math.max(0, Math.min(rawY, canvas.height - logoHeight));

        console.log('[logoCompositingService] Drawing logo at:', {
            x,
            y,
            rawX,
            rawY,
            clamped: x !== rawX || y !== rawY,
            logoWidth,
            logoHeight,
            originalSize: `${logoImg.width}x${logoImg.height}`,
            aspectRatio: logoAspectRatio,
            opacity: opacity / 100,
            offsetX,
            offsetY
        });

        // Apply opacity and draw logo with correct aspect ratio
        ctx.globalAlpha = opacity / 100;
        ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0; // Reset alpha

        // Convert to blob
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    console.log('[logoCompositingService] Compositing complete:', blob.size, 'bytes');
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            }, 'image/png');
        });
    } catch (error) {
        console.error('[logoCompositingService] Compositing failed:', error);
        throw error;
    }
}
