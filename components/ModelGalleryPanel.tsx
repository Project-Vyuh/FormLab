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
  // Dynamic button props
  hasSettingsChanged: boolean;
  hasOutfitChanged: boolean;
  applyButtonLabel: string;
  canApply: boolean;
}

const ModelGalleryPanel: React.FC<ModelGalleryPanelProps> = (props) => {
  const {
    selectedStylingModel, onNavigateToCreateModel, isLoading,
    generationSettings, onSettingsChange, openSections, onToggleSection, onPanelToggle, isGenerating,
    selectedLightId, onSelectLightId, onAddLight, onUpdateLight, onRemoveLight,
    categories, onCreateCategory, onRenameCategory, onDeleteCategory, onDeleteProduct,
    generationModels, selectedGenerationModel, onSelectGenerationModel,
    projectList, currentProjectId, onProjectChange, onOpenProjectModal,
    revisionPrompt, onRevisionPromptChange, onEnhanceRevisionPrompt, onApplyRevision, isEnhancingPrompt,
    hasSettingsChanged, hasOutfitChanged, applyButtonLabel, canApply
  } = props;

  return (
    <aside className="h-full flex-shrink-0 bg-[#1a1a1a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* --- FIXED TOP: Project Section --- */}
      <ProjectSelectorPanel
        projects={projectList}
        currentProjectId={currentProjectId}
        onProjectChange={onProjectChange}
        onEditProject={() => onOpenProjectModal('edit')}
        onCreateProject={() => onOpenProjectModal('create')}
        isCreateDisabled={true}
      />

      {/* --- SCROLLABLE MIDDLE: All Content Sections --- */}
      <div className="flex-grow min-h-0 overflow-y-auto p-4 space-y-6">
        {/* Your Selected Model */}
        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <UserIcon className="w-3.5 h-3.5" />
            Your Selected Model
          </h2>
          {selectedStylingModel ? (
            <div className="space-y-3">
              {/* Inline thumbnail and name */}
              <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10">
                <div className="w-[48px] h-[48px] flex-shrink-0 rounded-md overflow-hidden border border-white/10">
                  <img
                    src={selectedStylingModel.url}
                    alt={selectedStylingModel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-200 truncate text-xs">
                    {selectedStylingModel.name}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Selected from Create Model
                  </p>
                </div>
              </div>

              {/* Change Model button */}
              <button
                onClick={onNavigateToCreateModel}
                className="w-full py-2 text-xs font-medium text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Change Model
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full aspect-square rounded-lg border border-dashed border-white/10 flex items-center justify-center bg-white/5">
                <div className="text-center p-4">
                  <UserIcon className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-[10px] text-gray-500">
                    No model selected
                  </p>
                </div>
              </div>
              <button
                onClick={onNavigateToCreateModel}
                className="w-full py-2 text-xs font-medium text-white bg-[#318CE7] rounded-lg hover:bg-[#2b7bc0] transition-colors shadow-lg shadow-blue-500/20"
              >
                Go to Create Model
              </button>
            </div>
          )}
        </div>

        {/* Create Model Revision */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <PenLineIcon className="w-3.5 h-3.5" />
            Create Model Revision
          </h2>
          <PromptPanel
            prompt={revisionPrompt}
            onPromptChange={onRevisionPromptChange}
            placeholder="e.g., Change hair to blonde..."
            rows={3}
            isGenerating={isLoading}
            showEnhanceButton={true}
            onEnhance={onEnhanceRevisionPrompt}
            isEnhancing={isEnhancingPrompt}
            enhanceButtonText={revisionPrompt.trim() ? 'Enhance' : 'Suggest Revision Description'}
            showUploadButton={false}
          />
        </div>

        {/* Wardrobe Library */}
        <div className="space-y-3 pt-4 border-t border-white/5">
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
            onAddProduct={props.onAddProduct}
            categories={categories}
            onCreateCategory={onCreateCategory}
            onRenameCategory={onRenameCategory}
            onDeleteCategory={onDeleteCategory}
            onDeleteProduct={onDeleteProduct}
          />
        </div>

        <div className="pt-4 border-t border-white/5">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <PenLineIcon className="w-3.5 h-3.5" /> {/* Reusing icon for now, maybe SettingsIcon is better if available */}
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

      {/* --- FIXED BOTTOM: Generation Model Switcher --- */}
      <div className="flex-shrink-0 p-4 border-t border-white/5 bg-[#1a1a1a]/50 backdrop-blur-md">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
          <CubeIcon className="w-3 h-3 text-gray-600" />
          Generation Model
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {generationModels.map(model => (
            <button
              key={model.name}
              onClick={() => !model.disabled && onSelectGenerationModel(model.name)}
              title={model.title}
              disabled={isGenerating || model.disabled}
              className={`w-full text-center text-[10px] font-semibold py-1.5 px-2 rounded-md transition-all duration-200 border
                        ${selectedGenerationModel === model.name ? 'bg-white/10 text-white border-white/20 shadow-inner' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'}
                        ${model.disabled ? 'opacity-30 cursor-not-allowed' : ''}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {model.name}
            </button>
          ))}
        </div>
        <button
          onClick={onApplyRevision}
          disabled={isLoading || !canApply}
          className="w-full py-2 text-xs font-semibold text-black bg-white hover:bg-gray-200 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50 disabled:shadow-none mt-3"
        >
          {applyButtonLabel}
        </button>
      </div>
    </aside>
  );
};

export default ModelGalleryPanel;