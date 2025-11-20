/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Model, GenerationSettings, Light, LightRole, PanelToggles, WardrobeItem, Project, SelectedStylingModel } from '../types';
import { UploadCloudIcon, UserIcon, CubeIcon, PenLineIcon } from './icons';
import GlobalControls from './GlobalControls';
import WardrobeLibrary from './WardrobeLibrary';
import ProjectSelectorPanel from './ProjectSelectorPanel';
import PromptPanel from './PromptPanel';

interface ModelGalleryPanelProps {
  selectedStylingModel: SelectedStylingModel | null;
  onNavigateToCreateModel: () => void;
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
    selectedStylingModel, onNavigateToCreateModel, isLoading,
    generationSettings, onSettingsChange, openSections, onToggleSection, onPanelToggle, isGenerating,
    selectedLightId, onSelectLightId, onAddLight, onUpdateLight, onRemoveLight,
    categories, onCreateCategory, onRenameCategory, onDeleteCategory, onDeleteProduct,
    generationModels, selectedGenerationModel, onSelectGenerationModel,
    projectList, currentProjectId, onProjectChange, onOpenProjectModal,
    revisionPrompt, onRevisionPromptChange, onEnhanceRevisionPrompt, onApplyRevision, isEnhancingPrompt
  } = props;
  
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
      {/* --- Your Selected Model (Fixed Section) --- */}
      <div className="flex-shrink-0 p-4">
        <h2 className="text-base font-sans font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
          <UserIcon className="w-5 h-5" />
          Your Selected Model
        </h2>
        {selectedStylingModel ? (
          <div className="space-y-3">
            <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-blue-500 shadow-md">
              <img
                src={selectedStylingModel.url}
                alt={selectedStylingModel.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium text-gray-800 dark:text-gray-200 truncate">
                {selectedStylingModel.name}
              </p>
              <p className="text-xs mt-1">
                Selected from Create Model
              </p>
            </div>
            <button
              onClick={onNavigateToCreateModel}
              className="w-full py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Change Model
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
              <div className="text-center p-4">
                <UserIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  No model selected
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
              The base model or its version you selected in Create Model will appear here.
            </div>
            <button
              onClick={onNavigateToCreateModel}
              className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Create Model
            </button>
          </div>
        )}
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
    </aside>
  );
};

export default ModelGalleryPanel;