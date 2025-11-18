/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { VideoGenerationSettings, VideoAspectRatio, VideoResolution, CameraMotion, CinematicStyle, Project } from '../types';
import { VideoIcon, FilmIcon, SlidersHorizontalIcon, ChevronDownIcon, ArrowLeftRightIcon, ArrowUpDownIcon, ZoomInIcon, ZoomOutIcon, CameraIcon } from './icons';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import PromptPanel from './PromptPanel';

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

// Reusable UI Components, defined at the top level to prevent re-creation on render.
const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode, className?: string }> = ({ title, icon, children, className = '' }) => (
  <div className={className}>
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const OptionButton: React.FC<{ onClick: () => void; isActive: boolean; disabled: boolean; children: React.ReactNode, className?: string }> = ({ onClick, isActive, disabled, children, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-center text-sm font-medium py-1.5 px-2 rounded-md transition-all duration-200 border
      ${isActive 
        ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100' 
        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300 dark:bg-white/10 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-white/20 dark:hover:border-gray-500'}
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700 ${className}`}
  >
    {children}
  </button>
);


// UI Data
const aspectRatioOptions: { id: VideoAspectRatio; label: string }[] = [{ id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }];
const resolutionOptions: { id: VideoResolution; label: string }[] = [{ id: '720p', label: '720p' }, { id: '1080p', label: '1080p' }];
const cameraMotionOptions: { id: CameraMotion; label: string, icon: React.ReactNode }[] = [
    { id: 'pan-left', label: 'Pan Left', icon: <ArrowLeftRightIcon className="w-5 h-5 transform -scale-x-100" /> },
    { id: 'pan-right', label: 'Pan Right', icon: <ArrowLeftRightIcon className="w-5 h-5" /> },
    { id: 'tilt-up', label: 'Tilt Up', icon: <ArrowUpDownIcon className="w-5 h-5 transform -scale-y-100" /> },
    { id: 'tilt-down', label: 'Tilt Down', icon: <ArrowUpDownIcon className="w-5 h-5" /> },
    { id: 'zoom-in', label: 'Zoom In', icon: <ZoomInIcon className="w-5 h-5" /> },
    { id: 'zoom-out', label: 'Zoom Out', icon: <ZoomOutIcon className="w-5 h-5" /> },
];
const cinematicStyleOptions: { id: CinematicStyle; label: string }[] = [
    { id: 'timelapse', label: 'Timelapse' }, { id: 'slow-motion', label: 'Slow Motion' }, { id: 'hyperlapse', label: 'Hyperlapse' }, { id: 'black-and-white', label: 'B & W' },
];

const VideoControlPanel: React.FC<VideoControlPanelProps> = (props) => {
  const { 
    referenceImageUrl, settings, onSettingsChange, onGenerate, isLoading, isApiKeySelected, onSelectApiKey,
    projectList, currentProjectId, onProjectChange, onOpenProjectModal
  } = props;
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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
      <div className="flex-grow min-h-0 overflow-y-auto p-4 space-y-6">
        <h2 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200">Cinematic Direction Panel</h2>
        
        <Section title="Generation Mode" icon={<VideoIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}>
          <div className="bg-gray-200/70 dark:bg-white/10 rounded-lg p-1">
             <button className="w-full py-1.5 px-2 text-sm font-semibold rounded-md bg-white dark:bg-gray-100 dark:text-gray-900 shadow-sm">
                Image + Text
              </button>
          </div>
        </Section>
        
        <Section title="Input" className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
            {referenceImageUrl ? (
                <img src={referenceImageUrl} alt="Reference for video" className="rounded-lg w-full aspect-[2/3] object-cover border border-gray-200 dark:border-gray-700" />
            ) : (
                <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400 p-4">
                    <p>Go to the Image Studio to create a reference image.</p>
                </div>
            )}
             <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 block">Prompt</h3>
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
        </Section>

        <Section title="Output Settings" className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
            <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Aspect Ratio</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                    {aspectRatioOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange({ aspectRatio: option.id })} isActive={settings.aspectRatio === option.id} disabled={isLoading}>{option.label}</OptionButton>)}
                </div>
            </div>
             <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Resolution</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                    {resolutionOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange({ resolution: option.id })} isActive={settings.resolution === option.id} disabled={isLoading}>{option.label}</OptionButton>)}
                </div>
            </div>
        </Section>
        
        <Section title="Camera Motion" icon={<CameraIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}>
          <div className="grid grid-cols-3 gap-2">
            {cameraMotionOptions.map(option => 
              <OptionButton key={option.id} onClick={() => onSettingsChange({ cameraMotion: settings.cameraMotion === option.id ? 'none' : option.id })} 
                isActive={settings.cameraMotion === option.id} disabled={isLoading}
                className="flex flex-col items-center justify-center p-2 h-16"
              >
                  {option.icon}
                  <span className="text-xs mt-1">{option.label}</span>
              </OptionButton>
            )}
          </div>
        </Section>

        <div className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
            <button onClick={() => setIsAdvancedOpen(!isAdvancedOpen)} className="w-full flex justify-between items-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                <span className="flex items-center gap-2"><SlidersHorizontalIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />Advanced</span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {isAdvancedOpen && (
                <div className="mt-3 space-y-3">
                    <Section title="Cinematic Style" icon={<FilmIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />}>
                        <div className="grid grid-cols-4 gap-2">
                        {cinematicStyleOptions.map(option => <OptionButton key={option.id} onClick={() => onSettingsChange({ cinematicStyle: settings.cinematicStyle === option.id ? 'none' : option.id })} isActive={settings.cinematicStyle === option.id} disabled={isLoading}>{option.label}</OptionButton>)}
                        </div>
                    </Section>
                    <div>
                        <label htmlFor="video-negative-prompt" className="text-xs font-medium text-gray-600 dark:text-gray-400">Negative Prompt</label>
                        <textarea id="video-negative-prompt" name="video-negative-prompt" value={settings.negativePrompt} onChange={(e) => onSettingsChange({ negativePrompt: e.target.value })} placeholder="e.g., blurry, text, watermark" rows={2} disabled={isLoading}
                            className="mt-1 w-full text-sm p-2 bg-gray-100 dark:bg-white/10 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-gray-800 focus:border-gray-800 dark:focus:ring-gray-200 dark:focus:border-gray-200 transition disabled:opacity-50 placeholder:text-gray-500 dark:placeholder:text-gray-400" />
                    </div>
                </div>
            )}
        </div>

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
          className="w-full flex items-center justify-center text-center bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-700 dark:hover:bg-gray-300 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed">
          {isLoading ? 'Generating...' : 'Generate Video'}
        </button>
      </div>
    </aside>
  );
};

export default VideoControlPanel;