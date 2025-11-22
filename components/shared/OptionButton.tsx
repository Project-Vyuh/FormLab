/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

const OptionButton: React.FC<{ onClick: () => void; isActive: boolean; disabled: boolean; children: React.ReactNode }> = ({ onClick, isActive, disabled, children }) => (
    <button onClick={onClick} disabled={disabled} className={`w-full text-center text-[11px] font-semibold py-0.5 px-1.5 rounded transition-all duration-200 border ${isActive ? 'bg-gray-100 text-gray-900 border-gray-100' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'} disabled:opacity-50`}>
        {children}
    </button>
);

export default OptionButton;
