/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SectionHeadingProps {
    icon?: React.ReactNode;
    title: string;
    className?: string;
}

/**
 * Reusable section heading component for consistent styling across the app
 */
const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title, className = '' }) => {
    return (
        <div className={`flex items-center gap-2 mb-1 ${className}`}>
            {icon && <span className="text-blue-400/80">{icon}</span>}
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {title}
            </h3>
        </div>
    );
};

export default SectionHeading;
