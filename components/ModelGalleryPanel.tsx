/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Model, GenerationSettings, Light, LightRole, PanelToggles, WardrobeItem, Project } from '../types';
import { UploadCloudIcon, UserIcon, CubeIcon, PenLineIcon } from './icons';
import GlobalControls from './GlobalControls';
import WardrobeLibrary from './WardrobeLibrary';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import PromptPanel from './PromptPanel';

interface ModelGalleryPanelProps {
  models: Model[];
  selectedModelUrl: string | null;
  onSelectModel: (url: string) => void;
  onUploadModel: (file: File) => void;
  onDeleteModel: (model: Model) => void;
  isLoading: boolean;
  generationSettings: GenerationSettings;
  onSettingsChange: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  openSections: any;
  onToggleSection: (section: string) => void;
  onPanelToggle: (panel: keyof PanelToggles) => void;
  isGenerating: boolean;
  selectedLightId: string | null;
  onSelectLightId: (id: string | null) => void;
  onAddLight: (role: LightRole) => void;
  onUpdateLight: (id: string, updates: Partial<Light> | { position: Partial<Light['position']> }) => void;
  onRemoveLight: (id: string) => void;
  // Wardrobe Props
  wardrobe: WardrobeItem[];
  onWardrobeItemSelect: (item: WardrobeItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  favorites: string[];
  onToggleFavorite: (itemId: string) => void;
  recentlyUsed: WardrobeItem[];
  filters: Record<string, string[]>; 
  onFilterChange: (filterType: string, value: string) => void;
  onClearFilters: () => void;
  onAddProduct: (productData: Omit<WardrobeItem, 'id' | 'url'> & { file: File }) => void;
  categories: string[];
  onCreateCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (category: string) => void;
  onDeleteProduct: (product: WardrobeItem) => void;
  // Generation Model Switcher
  generationModels: { name: string; id: any; disabled?: boolean; title?: string }[];
  selectedGenerationModel: string;
  onSelectGenerationModel: (modelName: string) => void;
  // Project Props
  projectList: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onOpenProjectModal: (mode: 'create' | 'edit') => void;
  // Revision Props
  revisionPrompt: string;
  onRevisionPromptChange: (prompt: string) => void;
  onEnhanceRevisionPrompt: () => void;
  onApplyRevision: () => void;
  isEnhancingPrompt: boolean;
}

const ModelGalleryPanel: React.FC<ModelGalleryPanelProps> = (props) => {
  const {
    models, selectedModelUrl, onSelectModel, onUploadModel, onDeleteModel, isLoading,
    generationSettings, onSettingsChange, openSections, onToggleSection, onPanelToggle, isGenerating,
    selectedLightId, onSelectLightId, onAddLight, onUpdateLight, onRemoveLight,
    categories, onCreateCategory, onRenameCategory, onDeleteCategory, onDeleteProduct,
    generationModels, selectedGenerationModel, onSelectGenerationModel,
    projectList, currentProjectId, onProjectChange, onOpenProjectModal,
    revisionPrompt, onRevisionPromptChange, onEnhanceRevisionPrompt, onApplyRevision, isEnhancingPrompt
  } = props;
    
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, model: Model } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleContextMenu = (e: React.MouseEvent, model: Model) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, model });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadModel(e.target.files[0]);
      e.target.value = '';
    }
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
      <div className="p-4 border-b border-gray-700/60">
        <h3 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
            <PenLineIcon className="w-5 h-5" />
            Text Revision
        </h3>
        <PromptPanel
          prompt={revisionPrompt}
          onPromptChange={onRevisionPromptChange}
          placeholder="e.g., Change hair to blonde..."
          rows={3}
          isGenerating={isLoading}
          showEnhanceButton={true}
          onEnhance={onEnhanceRevisionPrompt}
          isEnhancing={isEnhancingPrompt}
          enhanceButtonText={revisionPrompt.trim() ? 'Enhance' : 'Suggest'}
          showUploadButton={false}
        />
        <button onClick={onApplyRevision} disabled={isLoading || !revisionPrompt.trim()} className="w-full mt-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">Apply Prompt</button>
      </div>
      {/* --- Your Models (Fixed Section) --- */}
      <div className="flex-shrink-0 p-4">
        <h2 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
          <UserIcon className="w-5 h-5" />
          Your Models
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {models.map(model => {
            const isSelected = model.url === selectedModelUrl;
            return (
              <div key={model.id} onContextMenu={(e) => handleContextMenu(e, model)}>
                <button onClick={() => onSelectModel(model.url)} disabled={isLoading || isSelected}
                  className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 dark:focus:ring-gray-200 group disabled:cursor-not-allowed ${isSelected ? 'border-gray-900 dark:border-gray-100 shadow-md' : 'border-gray-300/80 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
                  aria-label={`Select model ${model.id}`} >
                  <img src={model.url} alt={`Model ${model.id}`} className="w-full h-full object-cover" />
                </button>
              </div>
            );
          })}
        </div>
        <label htmlFor="new-model-upload" className={`mt-4 w-full h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100 dark:bg-white/5' : 'hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer'}`}>
          <UploadCloudIcon className="w-6 h-6 mb-1"/>
          <span className="text-sm text-center font-medium">Upload New Model</span>
          <input id="new-model-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
        </label>
      </div>

      <div className="border-t border-gray-700/60 mx-4"></div>

      {/* --- Scrollable area for Library and Controls --- */}
      <div className="flex-grow min-h-0 overflow-y-auto">
        <WardrobeLibrary 
          wardrobe={props.wardrobe}
          onSelectItem={props.onWardrobeItemSelect}
          searchQuery={props.searchQuery}
          onSearchChange={props.onSearchChange}
          selectedCategories={props.selectedCategories}
          onCategoryToggle={props.onCategoryToggle}
          favorites={props.favorites}
          onToggleFavorite={props.onToggleFavorite}
          recentlyUsed={props.recentlyUsed}
          filters={props.filters}
          onFilterChange={props.onFilterChange}
          onClearFilters={props.onClearFilters}
          onAddProduct={props.onAddProduct}
          categories={categories}
          onCreateCategory={onCreateCategory}
          onRenameCategory={onRenameCategory}
          onDeleteCategory={onDeleteCategory}
          onDeleteProduct={onDeleteProduct}
        />
        <div className="border-t border-gray-700/60 my-4 mx-4"></div>
        <div className="px-4 pb-4">
          <h2 className="text-base font-sans font-semibold text-gray-200 mb-4">
              Global Controls
          </h2>
          <GlobalControls
              generationSettings={generationSettings}
              onSettingsChange={onSettingsChange}
              isGenerating={isGenerating}
              openSections={openSections}
              onToggleSection={onToggleSection}
              selectedLightId={selectedLightId}
              onSelectLightId={onSelectLightId}
              onAddLight={onAddLight}
              onUpdateLight={onUpdateLight}
              onRemoveLight={onRemoveLight}
              onPanelToggle={onPanelToggle}
          />
        </div>
      </div>
      
       {/* --- Fixed bottom section for model switcher --- */}
       <div className="flex-shrink-0 p-4 border-t border-gray-800">
        <label className="text-xs font-medium text-gray-400 mb-2 block flex items-center gap-2">
            <CubeIcon className="w-4 h-4 text-gray-500" />
            Generation Model
        </label>
        <div className="grid grid-cols-3 gap-2">
            {generationModels.map(model => (
                <button
                    key={model.name}
                    onClick={() => !model.disabled && onSelectGenerationModel(model.name)}
                    title={model.title}
                    disabled={isGenerating || model.disabled}
                    className={`w-full text-center text-xs font-semibold py-1.5 px-2 rounded-md transition-all duration-200 border
                        ${selectedGenerationModel === model.name ? 'bg-gray-100 text-gray-900 border-gray-100' : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}
                        ${model.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {model.name}
                </button>
            ))}
        </div>
      </div>
       
      {contextMenu && (
        <div ref={contextMenuRef} style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 py-1">
            <button onClick={() => { onDeleteModel(contextMenu.model); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">Delete Model</button>
        </div>
      )}
    </aside>
  );
};

export default ModelGalleryPanel;