/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { LogoBrandingConfig } from '../types';

interface LogoPreviewOverlayProps {
    logoUrl: string;
    config: LogoBrandingConfig;
    imageWidth: number;   // Rendered image width
    imageHeight: number;  // Rendered image height
}

/**
 * Logo Preview Overlay Component
 * Displays logo preview positioned at corners of the image
 * Uses absolute positioning with clamping to match download behavior (WYSIWYG)
 */
const LogoPreviewOverlay: React.FC<LogoPreviewOverlayProps> = ({
    logoUrl,
    config,
    imageWidth,
    imageHeight
}) => {
    // Size mapping: percentage of image width (increased for better visibility)
    const sizeMap = {
        small: 0.10,   // 10% of image width
        medium: 0.15,  // 15%
        large: 0.22    // 22%
    };

    const logoSize = imageWidth * sizeMap[config.size];
    const basePadding = imageWidth * 0.02; // 2% base padding from edges

    if (!config.position || config.mode !== 'position' || !logoUrl) {
        return null;
    }

    // Calculate offset in pixels (percentage of image dimensions)
    const offsetXPx = (config.offsetX / 100) * imageWidth;
    const offsetYPx = (config.offsetY / 100) * imageHeight;

    // Determine offset direction based on position
    const isRightAligned = config.position.includes('right');
    const isBottomAligned = config.position.includes('bottom');
    const adjustedOffsetX = isRightAligned ? -offsetXPx : offsetXPx;
    const adjustedOffsetY = isBottomAligned ? -offsetYPx : offsetYPx;

    // Calculate base positions (before offset)
    const basePositions = {
        'top-left': {
            x: basePadding,
            y: basePadding
        },
        'top-right': {
            x: imageWidth - logoSize - basePadding,
            y: basePadding
        },
        'bottom-left': {
            x: basePadding,
            y: imageHeight - logoSize - basePadding
        },
        'bottom-right': {
            x: imageWidth - logoSize - basePadding,
            y: imageHeight - logoSize - basePadding
        },
    };

    const basePos = basePositions[config.position];

    // Apply offset and CLAMP to valid bounds (logo stays fully within image)
    const rawX = basePos.x + adjustedOffsetX;
    const rawY = basePos.y + adjustedOffsetY;

    const clampedX = Math.max(0, Math.min(rawX, imageWidth - logoSize));
    const clampedY = Math.max(0, Math.min(rawY, imageHeight - logoSize));

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: clampedX,
                top: clampedY,
                width: logoSize,
                height: logoSize,
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
