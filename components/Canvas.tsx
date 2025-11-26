

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { RotateCcwIcon, ChevronLeftIcon, ChevronRightIcon, UndoIcon, RedoIcon, UserIcon, ZoomInIcon, ZoomOutIcon } from './icons';
import Spinner from './Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import { AspectRatio } from '../types';

interface CanvasProps {
  displayImageUrl: string | null;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  availablePoseKeys: string[];
  aspectRatio: AspectRatio;
  isStudioEmpty?: boolean;
  zoom: number;
  setZoom: (zoom: number) => void;
}

const Canvas: React.FC<CanvasProps> = ({
    displayImageUrl, isLoading, loadingMessage,
    onSelectPose, poseInstructions, currentPoseIndex, availablePoseKeys,
    aspectRatio, isStudioEmpty, zoom, setZoom
}) => {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanPoint = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset zoom and pan when image changes
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [displayImageUrl, setZoom]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!displayImageUrl) return;
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.005;
    const clampedZoom = Math.max(1, Math.min(newZoom, 5)); // Zoom out stops at 100%, max zoom 500%
    setZoom(clampedZoom);

    // If we zoom out fully, reset pan
    if (clampedZoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    startPanPoint.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !imageContainerRef.current || !imageRef.current) return;
    e.preventDefault();
    
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = imageRef.current;
    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = containerRect.width / containerRect.height;

    let renderedImageWidth: number;
    let renderedImageHeight: number;

    if (imageAspectRatio > containerAspectRatio) {
      renderedImageWidth = containerRect.width;
      renderedImageHeight = renderedImageWidth / imageAspectRatio;
    } else {
      renderedImageHeight = containerRect.height;
      renderedImageWidth = renderedImageHeight * imageAspectRatio;
    }
    
    const scaledImageWidth = renderedImageWidth * zoom;
    const scaledImageHeight = renderedImageHeight * zoom;

    const newX = e.clientX - startPanPoint.current.x;
    const newY = e.clientY - startPanPoint.current.y;
    
    const maxX = Math.max(0, (scaledImageWidth - containerRect.width) / 2);
    const maxY = Math.max(0, (scaledImageHeight - containerRect.height) / 2);

    const clampedX = Math.max(-maxX, Math.min(newX, maxX));
    const clampedY = Math.max(-maxY, Math.min(newY, maxY));
    
    setPan({ x: clampedX, y: clampedY });
  };
  
  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };
  
  const getCursor = () => {
    if (!displayImageUrl) return 'default';
    if (zoom > 1) {
        return isPanning ? 'grabbing' : 'grab';
    }
    return 'zoom-in';
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#0f0f0f] relative overflow-hidden">
        {/* Main Viewport */}
        <div className="flex-grow relative w-full h-full overflow-hidden flex items-center justify-center p-4">
            <div 
                ref={imageContainerRef}
                className="w-full h-full flex items-center justify-center outline-none select-none"
                style={{ cursor: getCursor() }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
            >
                {isStudioEmpty ? (
                   <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-white/5 backdrop-blur-sm max-w-md">
                     <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <UserIcon className="w-8 h-8 text-gray-400 dark:text-gray-500"/>
                     </div>
                     <h3 className="text-xl font-sans font-semibold text-gray-700 dark:text-gray-200 mb-2">Studio Ready</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400">Select a model from the gallery on the left, or upload a new one to start styling.</p>
                   </div>
                ) : displayImageUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        ref={imageRef}
                        key={displayImageUrl}
                        src={displayImageUrl}
                        alt="Virtual try-on model"
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-sm transition-opacity duration-300"
                        style={{ 
                            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                        }}
                        draggable={false}
                      />
                  </div>
                ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Spinner />
                      <p className="text-md font-sans text-gray-600 dark:text-gray-400 mt-4 animate-pulse">Loading Model...</p>
                    </div>
                )}
            </div>
            
            <AnimatePresence>
              {isLoading && (
                  <motion.div
                      className="absolute inset-0 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-md flex flex-col items-center justify-center z-30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                  >
                      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-2xl shadow-xl flex flex-col items-center border border-gray-100 dark:border-gray-800">
                          <Spinner />
                          {loadingMessage && (
                              <p className="text-lg font-sans text-gray-800 dark:text-gray-200 mt-4 text-center px-4">{loadingMessage}</p>
                          )}
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
        </div>
        
        {/* Hint overlay when zoomed */}
        {zoom > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm pointer-events-none">
                Drag to Pan
            </div>
        )}
    </div>
  );
};

export default Canvas;