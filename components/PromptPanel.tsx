/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { UploadCloudIcon, WandIcon } from './icons';

interface PromptPanelProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    placeholder: string;
    rows?: number;
    isGenerating: boolean;

    showEnhanceButton: boolean;
    onEnhance?: () => void;
    isEnhancing?: boolean;
    enhanceButtonText?: string;

    showUploadButton: boolean;
    onFileUpload?: (file: File) => void;
    uploadDisabled?: boolean;
    uploadDisabledTooltip?: string;
}

const PromptPanel: React.FC<PromptPanelProps> = ({
    prompt,
    onPromptChange,
    placeholder,
    rows = 4,
    isGenerating,
    showEnhanceButton,
    onEnhance,
    isEnhancing,
    enhanceButtonText = 'Enhance Prompt',
    showUploadButton,
    onFileUpload,
    uploadDisabled = false,
    uploadDisabledTooltip = ''
}) => {

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && onFileUpload) {
            onFileUpload(e.target.files[0]);
        }
        e.target.value = ''; // Reset file input
    };

    return (
        <div className="space-y-2">
            <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full p-3 bg-black/20 text-gray-200 border border-white/10 rounded-lg text-xs placeholder-gray-600 focus:border-white/20 focus:bg-black/30 focus:ring-0 outline-none transition-all resize-none disabled:opacity-50"
                disabled={isGenerating}
            />
            <div className="flex items-center justify-between gap-2">
                {showEnhanceButton && (
                    <button
                        onClick={onEnhance}
                        disabled={isGenerating || isEnhancing}
                        className="text-[10px] font-medium text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-transparent bg-[#318CE7] hover:bg-[#318CE7]/90 transition-colors disabled:opacity-50"
                    >
                        <WandIcon className="w-3 h-3 text-white" />
                        {enhanceButtonText}
                    </button>
                )}
                {showUploadButton &&
                    <label
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-white/10 rounded-md text-[10px] font-medium text-gray-400 bg-white/5 transition-colors ${uploadDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20 hover:bg-white/10 hover:text-gray-300 cursor-pointer'}`}
                        title={uploadDisabledTooltip}
                    >
                        <UploadCloudIcon className="w-3 h-3" />
                        <span>Upload Photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploadDisabled || isGenerating} />
                    </label>
                }
            </div>
        </div>
    );
};

export default PromptPanel;
