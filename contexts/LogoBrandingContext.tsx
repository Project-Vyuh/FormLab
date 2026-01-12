/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LogoBrandingConfig, BrandLogo } from '../types';

interface LogoBrandingContextValue {
    logoBranding: LogoBrandingConfig;
    setLogoBranding: (config: LogoBrandingConfig) => void;
    brandLogos: BrandLogo[];
    setBrandLogos: (logos: BrandLogo[]) => void;
}

const LogoBrandingContext = createContext<LogoBrandingContextValue | undefined>(undefined);

/**
 * Logo Branding Provider
 * Provides shared logo branding state across components
 */
export const LogoBrandingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [logoBranding, setLogoBranding] = useState<LogoBrandingConfig>({
        selectedLogoId: null,
        mode: null,
        position: null,
        watermarkStyle: 'tiled',
        size: 'medium',
        opacity: 80,
        offsetX: 0,
        offsetY: 0
    });

    const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([]);

    return (
        <LogoBrandingContext.Provider value={{ logoBranding, setLogoBranding, brandLogos, setBrandLogos }}>
            {children}
        </LogoBrandingContext.Provider>
    );
};

/**
 * Hook to use logo branding context
 */
export const useLogoBranding = () => {
    const context = useContext(LogoBrandingContext);
    if (!context) {
        throw new Error('useLogoBranding must be used within a LogoBrandingProvider');
    }
    return context;
};
