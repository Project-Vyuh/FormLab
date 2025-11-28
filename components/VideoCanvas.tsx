/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import Spinner from './Spinner';
import { VideoAspectRatio } from '../types';
import { VideoIcon } from './icons';

interface VideoCanvasProps {
  videoUrl: string | null;
  isLoading: boolean;
  error: string | null;
  aspectRatio: VideoAspectRatio;
}

const getAspectRatioClass = (ratio: VideoAspectRatio) => {
  const mapping: Record<VideoAspectRatio, string> = {
    '16:9': 'aspect-[16/9]',
    '9:16': 'aspect-[9/16]',
  };
  return mapping[ratio] || 'aspect-[16/9]';
};

const VideoCanvas: React.FC<VideoCanvasProps> = ({ videoUrl, isLoading, error, aspectRatio }) => {
  const aspectRatioClass = getAspectRatioClass(aspectRatio);

  return (
    <div className={`relative max-w-full max-h-full ${aspectRatioClass} w-full bg-[#1a1a1a] rounded-lg flex items-center justify-center transition-all duration-300 ease-in-out border border-white/10 shadow-md`}>
      {isLoading && (
        <div className="absolute inset-0 bg-[#1a1a1a]/80 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-lg">
          <Spinner />
          <p className="text-lg font-sans font-semibold text-gray-300 mt-4 text-center px-4">Generating your video... This may take a few minutes.</p>
        </div>
      )}
      {!isLoading && videoUrl && !error && (
        <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain rounded-lg" />
      )}
      {!isLoading && !videoUrl && !error && (
        <div className="text-center text-gray-400 flex flex-col items-center">
          <VideoIcon className="w-12 h-12 text-gray-500 mb-4" />
          <h3 className="text-xl font-sans font-semibold text-gray-300">Video Creator</h3>
          <p className="text-sm">Your generated video will appear here.</p>
        </div>
      )}
      {error && !isLoading && (
        <div className="text-center text-red-600 p-4">
          <h3 className="text-xl font-sans font-semibold">Generation Failed</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoCanvas;