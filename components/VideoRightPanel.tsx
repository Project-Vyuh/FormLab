/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { VideoGenerationSettings, VideoModel, VideoExportFormat } from '../types';
import { CubeIcon, Share2Icon } from './icons';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';

interface VideoRightPanelProps {
  settings: VideoGenerationSettings;
  onSettingsChange: (newSettings: Partial<VideoGenerationSettings>) => void;
  isLoading: boolean;
  videoUrl: string | null;
  onExport: () => void;
}

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
  const [openSections, setOpenSections] = useState({
    model: true,
    export: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className="h-full bg-[#1a1a1a] flex flex-col border-l border-white/5">
      <div className="p-4 space-y-6 flex-grow overflow-y-auto">

        <CollapsibleSection
          title="Choose Model"
          icon={<CubeIcon className="w-3.5 h-3.5 text-gray-400" />}
          isOpen={openSections.model}
          onToggle={() => toggleSection('model')}
        >
          <div className="flex flex-col gap-2">
            {modelOptions.map(option => (
              <OptionButton key={option.id} onClick={() => onSettingsChange({ model: option.id })} isActive={settings.model === option.id} disabled={isLoading}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Choose Export Format"
          icon={<Share2Icon className="w-3.5 h-3.5 text-gray-400" />}
          isOpen={openSections.export}
          onToggle={() => toggleSection('export')}
        >
          <div className="grid grid-cols-3 gap-2">
            {exportFormatOptions.map(option => (
              <OptionButton key={option.id} onClick={() => onSettingsChange({ exportFormat: option.id })} isActive={settings.exportFormat === option.id} disabled={isLoading}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </aside>
  );
};

export default VideoRightPanel;