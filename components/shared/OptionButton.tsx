/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

const OptionButton: React.FC<{ onClick: () => void; isActive: boolean; disabled: boolean; children: React.ReactNode }> = ({ onClick, isActive, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-center text-[11px] font-medium py-1.5 px-2 rounded-lg transition-all duration-200 border ${isActive
                ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
        {children}
    </button>
);

export default OptionButton;
