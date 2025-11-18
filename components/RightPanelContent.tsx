

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OutfitStack from './OutfitStack';
import PerItemControls from './PerItemControls';
import { OutfitLayer } from '../types';
import { ChevronDownIcon, ChevronUpIcon, WandIcon, Share2Icon, DownloadIcon, VideoIcon, ClipboardIcon } from './icons';

// Note: Most of the logic from the old RightPanelContent has been moved into ImageStudio.tsx
// This component is now simpler and focuses on layout.

interface RightPanelContentProps {
  error: string | null;
  outfitStack: OutfitLayer[];
  onMoveLayerUp: (layerId: string) => void;
  onMoveLayerDown: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onRemoveLayer: (layerId: string) => void;
  onSelectLayer: (layerId: string | null) => void;
  selectedLayerId: string | null;
  onQuickReplace: (category: string) => void;
  modelImageUrl: string | null;
  
  isLoading: boolean;
  
  onGenerate: () => void;
  hasPendingChanges: boolean;

  onDownloadImage: () => void;
  onUseAsVideoReference: () => void;
  onCopySettings: () => void;

  // For mobile sheet view
  isSheet?: boolean;
  isSheetCollapsed?: boolean;
  onToggleSheet?: () => void;
}


const PanelMainContent: React.FC<Omit<RightPanelContentProps, 'isSheet' | 'isSheetCollapsed' | 'onToggleSheet'>> = (props) => {
    const selectedLayer = props.outfitStack.find(layer => layer.id === props.selectedLayerId);

    return (
      <>
        {props.error && (
          <div className="bg-red-500/10 border-l-4 border-red-500 text-red-400 p-3 rounded-md mb-4" role="alert">
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs">{props.error}</p>
          </div>
        )}
        <OutfitStack 
          layers={props.outfitStack}
          onMoveLayerUp={props.onMoveLayerUp}
          onMoveLayerDown={props.onMoveLayerDown}
          onToggleVisibility={props.onToggleVisibility}
          onRemove={props.onRemoveLayer}
          onSelect={props.onSelectLayer}
          selectedLayerId={props.selectedLayerId}
          onQuickReplace={props.onQuickReplace}
          modelImageUrl={props.modelImageUrl}
        />
        <PerItemControls selectedLayer={selectedLayer} />
      </>
    );
}


const RightPanelContent: React.FC<RightPanelContentProps> = (props) => {
  const { 
    isSheet = false, 
    isSheetCollapsed = false, 
    onToggleSheet, 
    isLoading,
    onGenerate,
    hasPendingChanges
  } = props;
  
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const CallToAction = (
    <div className="p-4 md:p-6 border-t border-gray-800 flex-shrink-0 relative bg-[#1a1a1a]">
        <button
            onClick={onGenerate}
            disabled={isLoading || !hasPendingChanges}
            className={`w-full flex items-center justify-center text-center font-semibold py-3.5 px-4 rounded-lg transition-all duration-200 ease-in-out text-base shadow-lg
                ${hasPendingChanges && !isLoading
                    ? 'bg-gray-100 text-gray-900 hover:bg-white/90 shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'}
            `}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">Generating...</span>
            ) : (
                <span className="flex items-center gap-2"><WandIcon className="w-5 h-5" /> Generate Image</span>
            )}
        </button>
        <div className="relative mt-2">
            <AnimatePresence>
                {isExportMenuOpen && (
                    <motion.div
                        ref={exportMenuRef}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 right-0 mb-2 w-full bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl z-10 py-1"
                    >
                        <button onClick={() => { props.onDownloadImage(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10">
                            <DownloadIcon className="w-4 h-4" /> Download Image (.jpg)
                        </button>
                        <button onClick={() => { props.onUseAsVideoReference(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10">
                            <VideoIcon className="w-4 h-4" /> Use as Video Reference
                        </button>
                        <button onClick={() => { props.onCopySettings(); setIsExportMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10">
                            <ClipboardIcon className="w-4 h-4" /> Copy Creative Settings
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                disabled={isLoading}
                className="w-full flex items-center justify-center text-center font-semibold py-3.5 px-4 rounded-lg transition-all duration-200 ease-in-out text-base border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
                <Share2Icon className="w-5 h-5 mr-2" /> Export
            </button>
        </div>
    </div>
  );

  if (isSheet) {
    return (
      <aside 
        className={`absolute bottom-0 right-0 h-auto w-full bg-[#1a1a1a]/95 backdrop-blur-md flex flex-col border-t border-gray-800 transition-transform duration-500 ease-in-out z-40 ${isSheetCollapsed ? 'translate-y-[calc(100%-5rem)]' : 'translate-y-0'}`}
        style={{ maxHeight: '90vh', transitionProperty: 'transform' }}
      >
        <button 
          onClick={onToggleSheet} 
          className="w-full h-8 flex items-center justify-center bg-gray-800/50 flex-shrink-0 rounded-t-xl"
          aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-400" /> : <ChevronDownIcon className="w-6 h-6 text-gray-400" />}
        </button>
        <div className="p-4 md:p-6 overflow-y-auto flex-grow flex flex-col gap-6">
            <PanelMainContent {...props} />
        </div>
        {CallToAction}
      </aside>
    );
  }

  // Desktop view
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 overflow-y-auto flex-grow flex flex-col gap-6">
        <PanelMainContent {...props} />
      </div>
      {CallToAction}
    </div>
  );
};

export default RightPanelContent;