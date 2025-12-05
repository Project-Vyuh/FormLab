/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import VideoControlPanel from './VideoControlPanel';
import VideoCanvas from './VideoCanvas';
import VideoRightPanel from './VideoRightPanel';
import ResizeHandle from './ResizeHandle';
import { generateVideoFromImage } from '../services/geminiService';
import { getFriendlyErrorMessage } from '../lib/utils';
import { VideoGenerationSettings, Project, User } from '../types';
import { DownloadIcon } from './icons';
import { uploadVideoBlob } from '../services/storageService';

interface VideoCreatorProps {
  referenceImageUrl: string | null;
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  currentUser: User | null;
}

const initialVideoSettings: VideoGenerationSettings = {
  mode: 'image-to-video',
  prompt: '',
  aspectRatio: '16:9',
  resolution: '720p',
  cameraMotion: 'none',
  cinematicStyle: 'none',
  negativePrompt: '',
  model: 'veo-3.1-fast-generate-preview',
  exportFormat: 'mp4',
};

const VideoCreator: React.FC<VideoCreatorProps> = ({
  referenceImageUrl,
  projectList,
  currentProjectId,
  onProjectChange,
  onOpenProjectModal,
  currentUser
}) => {
  const [settings, setSettings] = useState<VideoGenerationSettings>(initialVideoSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeySelected, setIsApiKeySelected] = useState(false);

  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(288);

  useEffect(() => {
    // Check for API key when component mounts
    const checkApiKey = async () => {
      // Check if aistudio API is available
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsApiKeySelected(hasKey);
        } catch (error) {
          console.warn('[VideoCreator] Failed to check API key:', error);
          setIsApiKeySelected(false);
        }
      } else {
        // AI Studio bridge not available - this is normal for standard web usage
        setIsApiKeySelected(false);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    setVideoUrl(null);
    setError(null);
    setSettings(initialVideoSettings);
  }, [referenceImageUrl]);

  const handleSettingsChange = useCallback((newSettings: Partial<VideoGenerationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const handleSelectApiKey = async () => {
    await window.aistudio.openSelectKey();
    // Optimistically assume key selection was successful to avoid race conditions.
    setIsApiKeySelected(true);
  };

  const handleStartOver = useCallback(() => {
    setVideoUrl(null);
    setError(null);
    setSettings(initialVideoSettings);
  }, []);

  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `formlab-video-${Date.now()}.${settings.exportFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateVideo = async () => {
    if (!referenceImageUrl || !settings.prompt || isLoading) return;
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      const resultUrl = await generateVideoFromImage(referenceImageUrl, settings);

      // Upload to Firebase Storage if user is logged in and result is a blob URL
      let finalVideoUrl = resultUrl;
      if (currentUser && resultUrl.startsWith('blob:')) {
        try {
          // Fetch the blob from the blob URL
          const response = await fetch(resultUrl);
          const blob = await response.blob();

          // Upload to Firebase Storage
          finalVideoUrl = await uploadVideoBlob(blob, currentUser.uid, `video_${Date.now()}.mp4`);
          console.log('Video uploaded to Firebase Storage:', finalVideoUrl);

          // Revoke the temporary blob URL to free memory
          URL.revokeObjectURL(resultUrl);
        } catch (uploadError) {
          console.error('Failed to upload video to Firebase Storage, using blob URL:', uploadError);
          // Fallback to blob URL if upload fails
        }
      }

      setVideoUrl(finalVideoUrl);
    } catch (err) {
      if (err instanceof Error && err.message?.includes('Requested entity was not found')) {
        setError('API Key error. Please select a valid API key.');
        setIsApiKeySelected(false); // Reset key state to prompt user again
      } else {
        setError(getFriendlyErrorMessage(err, 'Failed to generate video'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(Math.max(280, Math.min(newWidth, 500)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [leftPanelWidth]);

  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.max(240, Math.min(newWidth, 400)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [rightPanelWidth]);

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
        <h1 className="text-[15px] font-medium text-white/90">Video Creator</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleStartOver} className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors">Start Over</button>
          <button onClick={handleDownloadVideo} disabled={!videoUrl || isLoading} className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black text-[13px] font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Download Video <DownloadIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-row h-full flex-grow min-h-0">
        <div style={{ width: `${leftPanelWidth}px` }} className="flex-shrink-0 h-full">
          <VideoControlPanel
            referenceImageUrl={referenceImageUrl}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onGenerate={handleGenerateVideo}
            isLoading={isLoading}
            isApiKeySelected={isApiKeySelected}
            onSelectApiKey={handleSelectApiKey}
            projectList={projectList}
            currentProjectId={currentProjectId}
            onProjectChange={onProjectChange}
            onOpenProjectModal={onOpenProjectModal}
          />
        </div>
        <ResizeHandle onMouseDown={handleLeftDrag} />
        <div className="flex-grow h-full flex items-center justify-center bg-[#0f0f0f] relative p-4">
          <VideoCanvas
            videoUrl={videoUrl}
            isLoading={isLoading}
            error={error}
            aspectRatio={settings.aspectRatio}
          />
        </div>
        <ResizeHandle onMouseDown={handleRightDrag} />
        <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0 h-full">
          <VideoRightPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            isLoading={isLoading}
            videoUrl={videoUrl}
            onExport={handleDownloadVideo}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoCreator;