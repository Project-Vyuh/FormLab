/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, RefObject } from 'react';

export interface ImageBounds {
    width: number;      // Rendered width of image
    height: number;     // Rendered height of image
    left: number;       // Offset from container left edge
    top: number;        // Offset from container top edge
}

/**
 * Hook to track the actual rendered bounds of an image within its container.
 * Handles object-contain scaling and updates on resize/load.
 */
export function useImageBounds(
    imageRef: RefObject<HTMLImageElement>,
    containerRef: RefObject<HTMLDivElement>,
    zoom: number = 1
): ImageBounds | null {
    const [bounds, setBounds] = useState<ImageBounds | null>(null);

    useEffect(() => {
        const updateBounds = () => {
            const img = imageRef.current;
            const container = containerRef.current;

            if (!img || !container || !img.complete) return;

            // Get actual rendered dimensions (affected by object-contain)
            const imgRect = img.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calculate offset relative to container
            const left = imgRect.left - containerRect.left;
            const top = imgRect.top - containerRect.top;

            setBounds({
                width: imgRect.width,
                height: imgRect.height,
                left,
                top,
            });
        };

        const img = imageRef.current;
        if (!img) return;

        // Update on load
        img.addEventListener('load', updateBounds);

        // Update on resize
        const resizeObserver = new ResizeObserver(updateBounds);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // Initial calculation
        updateBounds();

        return () => {
            img.removeEventListener('load', updateBounds);
            resizeObserver.disconnect();
        };
    }, [imageRef, containerRef, zoom]);

    return bounds;
}
