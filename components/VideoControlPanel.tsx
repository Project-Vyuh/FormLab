/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { VideoGenerationSettings, VideoAspectRatio, VideoResolution, CameraMotion, CinematicStyle, Project } from '../types';
import { VideoIcon, FilmIcon, SlidersHorizontalIcon, ChevronDownIcon, ArrowLeftRightIcon, ArrowUpDownIcon, ZoomInIcon, ZoomOutIcon, CameraIcon, LayoutIcon } from './icons';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import PromptPanel from './PromptPanel';
import CollapsibleSection from './shared/CollapsibleSection';
import OptionButton from './shared/OptionButton';

interface VideoControlPanelProps {
  referenceImageUrl: string | null;
  settings: VideoGenerationSettings;
  onSettingsChange: (newSettings: Partial<VideoGenerationSettings>) => void;
  onGenerate: () => void;
  isLoading: boolean;
  isApiKeySelected: boolean;
  onSelectApiKey: () => void;
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
}

// UI Data
const aspectRatioOptions: { id: VideoAspectRatio; label: string }[] = [{ id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }];
const resolutionOptions: { id: VideoResolution; label: string }[] = [{ id: '720p', label: '720p' }, { id: '1080p', label: '1080p' }];
const cameraMotionOptions: { id: CameraMotion; label: string, icon: React.ReactNode }[] = [
  { id: 'pan-left', label: 'Pan Left', icon: <ArrowLeftRightIcon className="w-3.5 h-3.5 transform -scale-x-100" /> },
  { id: 'pan-right', label: 'Pan Right', icon: <ArrowLeftRightIcon className="w-3.5 h-3.5" /> },
  { id: 'tilt-up', label: 'Tilt Up', icon: <ArrowUpDownIcon className="w-3.5 h-3.5 transform -scale-y-100" /> },
  { id: 'tilt-down', label: 'Tilt Down', icon: <ArrowUpDownIcon className="w-3.5 h-3.5" /> },
  { id: 'zoom-in', label: 'Zoom In', icon: <ZoomInIcon className="w-3.5 h-3.5" /> },
  { id: 'zoom-out', label: 'Zoom Out', icon: <ZoomOutIcon className="w-3.5 h-3.5" /> },
];
const cinematicStyleOptions: { id: CinematicStyle; label: string }[] = [
  { id: 'timelapse', label: 'Timelapse' }, { id: 'slow-motion', label: 'Slow Motion' }, { id: 'hyperlapse', label: 'Hyperlapse' }, { id: 'black-and-white', label: 'B & W' },
];

const VideoControlPanel: React.FC<VideoControlPanelProps> = (props) => {
  const {
    referenceImageUrl, settings, onSettingsChange, onGenerate, isLoading, isApiKeySelected, onSelectApiKey,
    projectList, currentProjectId, onProjectChange, onOpenProjectModal
  } = props;

  const [openSections, setOpenSections] = useState({
    composition: true,
    camera: true,
    advanced: false
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside className="h-full flex-shrink-0 bg-white dark:bg-[#1a1a1a] border-r border-gray-200/60 dark:border-gray-700/60 flex flex-col">
      <ProjectSelectorPanel
        projects={projectList}
        currentProjectId={currentProjectId}
        onProjectChange={onProjectChange}
        onEditProject={() => onOpenProjectModal('edit')}
        onCreateProject={() => onOpenProjectModal('create')}
        isCreateDisabled={true}
      />
      <div className="flex-grow min-h-0 overflow-y-auto p-4">
        {/* Input Section - Kept prominent as it's the starting point */}
        <div className="mb-6">
          <h3 className="text-[11px] font-medium text-gray-400 mb-2">Input</h3>
          {referenceImageUrl ? (
            <img src={referenceImageUrl} alt="Reference for video" className="rounded-lg w-full aspect-[2/3] object-cover border border-gray-200 dark:border-gray-700" />
          ) : (
            <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 p-4 border border-dashed border-gray-300 dark:border-gray-700">
              <p>Go to the Image Studio to create a reference image.</p>
            </div>
          )}
          <div className="mt-4">
            <h3 className="text-[11px] font-medium text-gray-400 mb-2">Prompt</h3>
            <PromptPanel
              prompt={settings.prompt}
              onPromptChange={(p) => onSettingsChange({ prompt: p })}
              placeholder="e.g., The model walks through a bustling city street at sunset..."
              rows={4}
              isGenerating={isLoading}
              showEnhanceButton={false}
              showUploadButton={false}
            />
          </div>
        </div>

        <CollapsibleSection
          title="Composition"
          icon={<LayoutIcon className="w-3.5 h-3.5 text-gray-600" />}
          isOpen={openSections.composition}
          onToggle={() => toggleSection('composition')}
        >
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-gray-400">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                {aspectRatioOptions.map(option => (
                  <OptionButton
                    key={option.id}
                    onClick={() => onSettingsChange({ aspectRatio: option.id })}
                    isActive={settings.aspectRatio === option.id}
                    disabled={isLoading}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-400">Resolution</label>
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                {resolutionOptions.map(option => (
                  <OptionButton
                    key={option.id}
                    onClick={() => onSettingsChange({ resolution: option.id })}
                    isActive={settings.resolution === option.id}
                    disabled={isLoading}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Camera & Motion"
          icon={<CameraIcon className="w-3.5 h-3.5 text-gray-600" />}
          isOpen={openSections.camera}
          onToggle={() => toggleSection('camera')}
        >
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-gray-400">Camera Motion</label>
              <div className="grid grid-cols-3 gap-1.5 mt-0.5">
                {cameraMotionOptions.map(option => (
                  <OptionButton
                    key={option.id}
                    onClick={() => onSettingsChange({ cameraMotion: settings.cameraMotion === option.id ? 'none' : option.id })}
                    isActive={settings.cameraMotion === option.id}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-1.5"
                  >
                    {option.icon}
                    <span className="text-[10px]">{option.label}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-400">Cinematic Style</label>
              <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                {cinematicStyleOptions.map(option => (
                  <OptionButton
                    key={option.id}
                    onClick={() => onSettingsChange({ cinematicStyle: settings.cinematicStyle === option.id ? 'none' : option.id })}
                    isActive={settings.cinematicStyle === option.id}
                    disabled={isLoading}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Advanced"
          icon={<SlidersHorizontalIcon className="w-3.5 h-3.5 text-gray-600" />}
          isOpen={openSections.advanced}
          onToggle={() => toggleSection('advanced')}
        >
          <div>
            <label htmlFor="video-negative-prompt" className="text-[11px] font-medium text-gray-400">Negative Prompt</label>
            <textarea
              id="video-negative-prompt"
              name="video-negative-prompt"
              value={settings.negativePrompt}
              onChange={(e) => onSettingsChange({ negativePrompt: e.target.value })}
              placeholder="e.g., blurry, text, watermark"
              rows={2}
              disabled={isLoading}
              className="mt-1 w-full p-3 bg-black/20 text-gray-200 border border-white/10 rounded-lg text-xs placeholder-gray-600 focus:border-white/20 focus:bg-black/30 focus:ring-0 outline-none transition-all resize-none disabled:opacity-50"
            />
          </div>
        </CollapsibleSection>

      </div>
      <div className="flex-shrink-0 p-4 mt-auto border-t border-gray-200/80 dark:border-gray-700/80">
        {!isApiKeySelected && (
          <div className="mb-3 text-center p-3 bg-blue-500/10 dark:bg-blue-500/10 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">An API key is required to generate videos.</p>
            <button
              onClick={onSelectApiKey}
              className="w-full text-center bg-blue-500 text-white font-semibold py-2 px-3 rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-600 active:scale-95 text-sm"
            >
              Select API Key
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Learn about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-300">billing</a>.
            </p>
          </div>
        )}
        <button onClick={onGenerate} disabled={isLoading || !settings.prompt || !referenceImageUrl || !isApiKeySelected}
          className="w-full py-2 text-xs font-semibold text-black bg-white hover:bg-gray-200 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50 disabled:shadow-none">
          {isLoading ? 'Generating...' : 'Generate Video'}
        </button>
      </div>
    </aside>
  );
};

export default VideoControlPanel;