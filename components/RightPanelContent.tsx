import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OutfitStack from './OutfitStack';
import { OutfitLayer, CompositeSubject, HistoryItem } from '../types';
import { ChevronDownIcon, ChevronUpIcon, WandIcon, Share2Icon, DownloadIcon, VideoIcon, ClipboardIcon, PlusIcon, Trash2Icon, UserIcon, ZapIcon } from './icons';

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

  // Composite Mode Props
  isCompositeMode: boolean;
  onCompositeModeToggle: (mode: boolean) => void;
  compositeSubjects: CompositeSubject[];
  onAddCompositeSubject: (subject: CompositeSubject) => void;
  onRemoveCompositeSubject: (id: string) => void;
  compositePrompt: string;
  onCompositePromptChange: (prompt: string) => void;
  history: HistoryItem[];
  selectedGenerationModel: string;
  onUploadCompositeSubject: (file: File) => void;
  // Props for Composite Selection
  isCompositeRevision?: boolean;
  currentProjectId?: string;
  currentCompositeHistoryId?: string | null;
  onSelectCompositeHistoryItem?: (id: string | null) => void;
  onDeleteComposite?: (id: string) => void;

  // For mobile sheet view
  isSheet?: boolean;
  isSheetCollapsed?: boolean;
  onToggleSheet?: () => void;
}


import CompositesSection from './CompositesSection';

const PanelMainContent: React.FC<Omit<RightPanelContentProps, 'isSheet' | 'isSheetCollapsed' | 'onToggleSheet'>> = (props) => {
  const isProModel = props.selectedGenerationModel === 'Nano Banana Pro';

  return (
    <div className="flex flex-col gap-6 h-full">
      {props.error && (
        <div className="bg-red-500/10 border-l-4 border-red-500 text-red-400 p-3 rounded-md" role="alert">
          <p className="font-bold text-sm">Error</p>
          <p className="text-xs">{props.error}</p>
        </div>
      )}

      {/* Standard Features (disabled in composite mode) */}
      <div className={props.isCompositeMode ? "opacity-30 pointer-events-none grayscale transition-all" : "transition-all"}>
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
      </div>

      {/* Composites Section */}
      <CompositesSection
        isCompositeMode={props.isCompositeMode}
        onCompositeModeToggle={props.onCompositeModeToggle}
        compositeSubjects={props.compositeSubjects}
        onAddCompositeSubject={props.onAddCompositeSubject}
        onRemoveCompositeSubject={props.onRemoveCompositeSubject}
        compositePrompt={props.compositePrompt}
        onCompositePromptChange={props.onCompositePromptChange}
        onGenerate={props.onGenerate}
        isLoading={props.isLoading}
        isProModel={isProModel}
        history={props.history}
        onUploadCompositeSubject={props.onUploadCompositeSubject}
        isCompositeRevision={props.isCompositeRevision}
        currentProjectId={props.currentProjectId}
        currentCompositeHistoryId={props.currentCompositeHistoryId}
        onSelectCompositeHistoryItem={props.onSelectCompositeHistoryItem}
        onDeleteComposite={props.onDeleteComposite}
      />

      {!props.isCompositeMode && (
        <div className="flex flex-col gap-3 mt-auto pt-6 border-t border-white/5">
        </div>
      )}
    </div>
  );
}


const RightPanelContent: React.FC<RightPanelContentProps> = (props) => {
  const {
    isSheet = false,
    isSheetCollapsed = false,
    onToggleSheet
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
        <div className="p-4 md:p-6 overflow-y-auto flex-grow flex flex-col">
          <PanelMainContent {...props} />
        </div>
      </aside>
    );
  }

  // Desktop view
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 overflow-y-auto flex-grow flex flex-col">
        <PanelMainContent {...props} />
      </div>
    </div>
  );
};

export default RightPanelContent;