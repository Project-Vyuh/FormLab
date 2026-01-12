/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { LogoBrandingConfig } from '../types';

interface LogoPreviewOverlayProps {
    logoUrl: string;
    config: LogoBrandingConfig;
    imageWidth: number;   // Rendered image width
    imageHeight: number;  // Rendered image height
    logoNaturalWidth?: number;  // Natural logo width (for aspect ratio)
    logoNaturalHeight?: number; // Natural logo height (for aspect ratio)
}

/**
 * Logo Preview Overlay Component
 * Displays logo preview positioned at corners of the image
 * Uses absolute positioning with clamping to match download behavior (WYSIWYG)
 * 
 * Supports both stored dimensions (new logos) and dynamically loaded dimensions (old logos)
 */
const LogoPreviewOverlay: React.FC<LogoPreviewOverlayProps> = ({
    logoUrl,
    config,
    imageWidth,
    imageHeight,
    logoNaturalWidth,
    logoNaturalHeight
}) => {
    // State for dynamically loaded dimensions (fallback for old logos without stored dimensions)
    const [loadedDimensions, setLoadedDimensions] = useState<{ width: number; height: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load dimensions dynamically if not provided (for backwards compatibility)
    useEffect(() => {
        // If dimensions are already provided, no need to load
        if (logoNaturalWidth && logoNaturalHeight && logoNaturalWidth > 0 && logoNaturalHeight > 0) {
            setLoadedDimensions(null);
            setIsLoading(false);
            return;
        }

        // Load the image to get dimensions
        setIsLoading(true);
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            setLoadedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setIsLoading(false);
        };

        img.onerror = () => {
            console.error('[LogoPreviewOverlay] Failed to load logo for dimension calculation');
            setIsLoading(false);
        };

        img.src = logoUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [logoUrl, logoNaturalWidth, logoNaturalHeight]);

    // Determine actual dimensions to use (stored or dynamically loaded)
    const actualWidth = (logoNaturalWidth && logoNaturalWidth > 0) ? logoNaturalWidth : loadedDimensions?.width;
    const actualHeight = (logoNaturalHeight && logoNaturalHeight > 0) ? logoNaturalHeight : loadedDimensions?.height;

    // Size mapping: percentage of image width
    const sizeMap = {
        small: 0.10,   // 10% of image width
        medium: 0.15,  // 15%
        large: 0.22    // 22%
    };

    const logoMaxSize = imageWidth * sizeMap[config.size];
    const basePadding = imageWidth * 0.02; // 2% base padding from edges

    // Don't render until we have valid dimensions and config
    if (!config.position || config.mode !== 'position' || !logoUrl) {
        return null;
    }

    // Don't render while loading dimensions (prevents flash of incorrect position)
    if (!actualWidth || !actualHeight || isLoading) {
        return null;
    }

    // Calculate actual logo dimensions preserving aspect ratio (matches compositing service exactly)
    const logoAspectRatio = actualWidth / actualHeight;
    let logoWidth: number;
    let logoHeight: number;

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
    const offsetXPx = (config.offsetX / 100) * imageWidth;
    const offsetYPx = (config.offsetY / 100) * imageHeight;

    // Determine offset direction based on position
    const isRightAligned = config.position.includes('right');
    const isBottomAligned = config.position.includes('bottom');
    const adjustedOffsetX = isRightAligned ? -offsetXPx : offsetXPx;
    const adjustedOffsetY = isBottomAligned ? -offsetYPx : offsetYPx;

    // Calculate base positions (before offset) - using actual logo dimensions
    const basePositions = {
        'top-left': {
            x: basePadding,
            y: basePadding
        },
        'top-right': {
            x: imageWidth - logoWidth - basePadding,
            y: basePadding
        },
        'bottom-left': {
            x: basePadding,
            y: imageHeight - logoHeight - basePadding
        },
        'bottom-right': {
            x: imageWidth - logoWidth - basePadding,
            y: imageHeight - logoHeight - basePadding
        },
    };

    const basePos = basePositions[config.position];

    // Apply offset and CLAMP to valid bounds (logo stays fully within image)
    const rawX = basePos.x + adjustedOffsetX;
    const rawY = basePos.y + adjustedOffsetY;

    const clampedX = Math.max(0, Math.min(rawX, imageWidth - logoWidth));
    const clampedY = Math.max(0, Math.min(rawY, imageHeight - logoHeight));

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: clampedX,
                top: clampedY,
                width: logoWidth,
                height: logoHeight,
                opacity: config.opacity / 100,
                zIndex: 20,
            }}
        >
            <img
                src={logoUrl}
                alt="Logo preview"
                className="w-full h-full object-contain drop-shadow-lg"
                style={{ pointerEvents: 'none' }}
                crossOrigin="anonymous"
            />
        </div>
    );
};

export default LogoPreviewOverlay;
