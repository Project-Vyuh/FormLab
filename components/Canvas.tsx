

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
  onStartOver: () => void;
  isLoading: boolean;
  loadingMessage: string;
  onSelectPose: (index: number) => void;
  poseInstructions: string[];
  currentPoseIndex: number;
  availablePoseKeys: string[];
  aspectRatio: AspectRatio;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isStudioEmpty?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ 
    displayImageUrl, onStartOver, isLoading, loadingMessage, 
    onSelectPose, poseInstructions, currentPoseIndex, availablePoseKeys,
    aspectRatio, onUndo, onRedo, canUndo, canRedo, isStudioEmpty
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanPoint = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Reset zoom and pan when image changes
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [displayImageUrl]);

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
  
  const handleStartOverWithReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onStartOver();
  };
  
  const handlePreviousPose = () => {
    if (isLoading || availablePoseKeys.length <= 1) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);
    
    if (currentIndexInAvailable === -1) {
        onSelectPose((currentPoseIndex - 1 + poseInstructions.length) % poseInstructions.length);
        return;
    }

    const prevIndexInAvailable = (currentIndexInAvailable - 1 + availablePoseKeys.length) % availablePoseKeys.length;
    const prevPoseInstruction = availablePoseKeys[prevIndexInAvailable];
    const newGlobalPoseIndex = poseInstructions.indexOf(prevPoseInstruction);
    
    if (newGlobalPoseIndex !== -1) {
        onSelectPose(newGlobalPoseIndex);
    }
  };

  const handleNextPose = () => {
    if (isLoading) return;

    const currentPoseInstruction = poseInstructions[currentPoseIndex];
    const currentIndexInAvailable = availablePoseKeys.indexOf(currentPoseInstruction);

    if (currentIndexInAvailable === -1 || availablePoseKeys.length === 0) {
        onSelectPose((currentPoseIndex + 1) % poseInstructions.length);
        return;
    }
    
    const nextIndexInAvailable = currentIndexInAvailable + 1;
    if (nextIndexInAvailable < availablePoseKeys.length) {
        const nextPoseInstruction = availablePoseKeys[nextIndexInAvailable];
        const newGlobalPoseIndex = poseInstructions.indexOf(nextPoseInstruction);
        if (newGlobalPoseIndex !== -1) {
            onSelectPose(newGlobalPoseIndex);
        }
    } else {
        const newGlobalPoseIndex = (currentPoseIndex + 1) % poseInstructions.length;
        onSelectPose(newGlobalPoseIndex);
    }
  };
  
  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#0f0f0f] relative overflow-hidden">
        {/* Professional Toolbar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] flex-shrink-0 z-20 shadow-sm">
             <div className="flex items-center gap-3">
                 <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700/50 rounded-lg p-0.5">
                    <button onClick={onUndo} disabled={!canUndo || isLoading} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors" title="Undo">
                        <UndoIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>
                    <button onClick={onRedo} disabled={!canRedo || isLoading} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors" title="Redo">
                        <RedoIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                 </div>
                 {displayImageUrl && (
                    <button 
                        onClick={handleStartOverWithReset} 
                        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
                    >
                        <RotateCcwIcon className="w-3.5 h-3.5" /> 
                        <span className="hidden sm:inline">Start Over</span>
                    </button>
                 )}
            </div>

            {/* Pose Navigation */}
             <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                 {displayImageUrl && (
                     <div className="flex items-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700/50 rounded-lg p-1 shadow-sm">
                        <button onClick={handlePreviousPose} disabled={isLoading} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                            <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-36 text-center truncate px-2 select-none">
                            {poseInstructions[currentPoseIndex]}
                        </span>
                        <button onClick={handleNextPose} disabled={isLoading} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 transition-colors">
                            <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                     </div>
                 )}
             </div>

             {/* Zoom Controls / Info */}
             <div className="flex items-center gap-2 text-xs font-mono text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-gray-700/50 rounded-lg px-2 py-1">
                    {Math.round(zoom * 100)}%
                </div>
             </div>
        </div>

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