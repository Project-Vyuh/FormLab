/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { VideoGenerationSettings, VideoModel, VideoExportFormat } from '../types';
import { CubeIcon, Share2Icon } from './icons';

interface VideoRightPanelProps {
  settings: VideoGenerationSettings;
  onSettingsChange: (newSettings: Partial<VideoGenerationSettings>) => void;
  isLoading: boolean;
  videoUrl: string | null;
  onExport: () => void;
}

// Reusable UI Components, defined at the top level to prevent re-creation on render.
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const OptionButton: React.FC<{ onClick: () => void; isActive: boolean; disabled: boolean; children: React.ReactNode }> = ({ onClick, isActive, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-center text-sm font-medium py-1.5 px-2 rounded-md transition-all duration-200 border
      ${isActive 
        ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100' 
        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300 dark:bg-white/10 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-white/20 dark:hover:border-gray-500'}
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700`}
  >
    {children}
  </button>
);


const modelOptions: { id: VideoModel; label: string }[] = [
  { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast' },
  { id: 'veo-3.1-generate-preview', label: 'Veo 3.1 HQ' },
];

const exportFormatOptions: { id: VideoExportFormat; label: string }[] = [
  { id: 'mp4', label: 'MP4' },
  { id: 'mov', label: 'MOV' },
  { id: 'gif', label: 'GIF' },
];

const VideoRightPanel: React.FC<VideoRightPanelProps> = ({ settings, onSettingsChange, isLoading, videoUrl, onExport }) => {

  return (
    <aside className="h-full bg-white dark:bg-[#1a1a1a] flex flex-col border-l border-gray-200/60 dark:border-gray-700/60">
      <div className="p-4 space-y-6 flex-grow overflow-y-auto">
        <h2 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200">Video Settings</h2>
        
        <Section title="Choose Model" icon={<CubeIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}>
          <div className="flex flex-col gap-2">
            {modelOptions.map(option => (
              <OptionButton key={option.id} onClick={() => onSettingsChange({ model: option.id })} isActive={settings.model === option.id} disabled={isLoading}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </Section>

        <Section title="Choose Export Format" icon={<Share2Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}>
          <div className="grid grid-cols-3 gap-2">
            {exportFormatOptions.map(option => (
              <OptionButton key={option.id} onClick={() => onSettingsChange({ exportFormat: option.id })} isActive={settings.exportFormat === option.id} disabled={isLoading}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </Section>
      </div>

      <div className="flex-shrink-0 p-4 mt-auto border-t border-gray-200/80 dark:border-gray-700/80">
        <button 
          onClick={onExport}
          disabled={isLoading || !videoUrl}
          className="w-full flex items-center justify-center text-center bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-700 dark:hover:bg-gray-300 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export Video
        </button>
      </div>
    </aside>
  );
};

export default VideoRightPanel;