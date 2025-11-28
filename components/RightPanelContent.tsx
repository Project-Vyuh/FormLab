

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OutfitStack from './OutfitStack';
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
  baseModelName?: string;

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
        baseModelName={props.baseModelName}
      />
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


  if (isSheet) {
    return (
      <aside
        className={`absolute bottom-0 right-0 h-auto w-full bg-[#1a1a1a]/95 backdrop-blur-md flex flex-col border-t border-white/5 transition-transform duration-500 ease-in-out z-40 ${isSheetCollapsed ? 'translate-y-[calc(100%-5rem)]' : 'translate-y-0'}`}
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
      </aside>
    );
  }

  // Desktop view
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 overflow-y-auto flex-grow flex flex-col gap-4">
        <PanelMainContent {...props} />
      </div>
    </div>
  );
};

export default RightPanelContent;