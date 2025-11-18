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
                className="w-full p-3 bg-black/30 text-gray-200 border border-gray-700 rounded-lg text-sm disabled:opacity-50"
                disabled={isGenerating}
            />
            <div className="flex items-end justify-between gap-2">
                {showEnhanceButton && (
                    <button onClick={onEnhance} disabled={isGenerating || isEnhancing} className="text-xs text-blue-400 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-blue-500/10 disabled:opacity-50">
                        <WandIcon className="w-3.5 h-3.5" />
                        {enhanceButtonText}
                    </button>
                )}
                {showUploadButton && 
                    <label 
                        className={`flex items-center gap-1.5 px-2 py-1.5 border border-dashed border-gray-700 rounded-md text-xs text-gray-400 ${uploadDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-600 cursor-pointer'}`}
                        title={uploadDisabledTooltip}
                    >
                        <UploadCloudIcon className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploadDisabled || isGenerating} />
                    </label>
                }
            </div>
        </div>
    );
};

export default PromptPanel;
