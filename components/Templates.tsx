/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, FolderPlusIcon, FilePlusIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon, FilterIcon, LayoutIcon, BookmarkIcon, Trash2Icon, DownloadIcon, Share2Icon } from './icons';
import CreateTemplateModal from './CreateTemplateModal';
import CreateFolderModal from './CreateFolderModal';
import AddTemplateItemModal from './AddTemplateItemModal';
import { loadPredefinedTemplates, loadUserTemplates, PredefinedTemplate, UserTemplate, loadPredefinedModels, PredefinedModel } from '../services/firestoreService';
import { createTemplate } from '../services/templateService';
import { User } from '../types';
import UserModelsCollectionView from './UserModelsCollectionView';

type TemplateCategory = 'models' | 'wardrobe';
type ViewMode = 'grid' | 'list';
type GenderFilter = 'male' | 'female' | 'lgbtq+';

interface Template {
  id: string;
  name: string;
  thumbnail: string;
  category: TemplateCategory;
  tags: string[];
  isStarred: boolean;
  downloads: number;
  createdAt: string;
  gender?: GenderFilter; // For model templates
  wardrobeCategory?: string; // For wardrobe templates
}

interface TemplatesProps {
  wardrobeCategories?: string[]; // Categories from ImageStudio
  currentUser?: User | null; // Current logged-in user
}

const Templates: React.FC<TemplatesProps> = ({ wardrobeCategories = [], currentUser = null }) => {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('models');
  const [isUserDefinedExpanded, setIsUserDefinedExpanded] = useState(true);
  const [isPreDefinedExpanded, setIsPreDefinedExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<'user' | 'predefined'>('user');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedGenderFilters, setSelectedGenderFilters] = useState<GenderFilter[]>([]);
  const [selectedWardrobeFilters, setSelectedWardrobeFilters] = useState<string[]>([]);

  // Quick filter state for Pre-Defined section
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);

  // Template data states
  const [predefinedTemplates, setPredefinedTemplates] = useState<(PredefinedTemplate | UserTemplate)[]>([]);
  const [userTemplates, setUserTemplates] = useState<(PredefinedTemplate | UserTemplate)[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Pre-defined models state
  const [predefinedModels, setPredefinedModels] = useState<PredefinedModel[]>([]);

  // Modal state for model detail view
  const [selectedModel, setSelectedModel] = useState<PredefinedModel | null>(null);

  // Modal states
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

  // Custom collections (folders) state
  const [customCollections, setCustomCollections] = useState<string[]>([]);

  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Computed: Get current templates based on selected section
  const templates = selectedSection === 'predefined' ? predefinedTemplates : userTemplates;

  // Click outside handler for filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset filters when section or category changes
  useEffect(() => {
    setSelectedGenderFilters([]);
    setSelectedWardrobeFilters([]);
    setSelectedQuickFilter(null);
  }, [activeCategory, selectedSection]);

  // Load templates and models on mount
  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        // Load pre-defined templates
        const predefined = await loadPredefinedTemplates();
        setPredefinedTemplates(predefined);
        console.log(`Loaded ${predefined.length} pre-defined templates`);

        // Load pre-defined models
        const models = await loadPredefinedModels();
        setPredefinedModels(models);
        console.log(`Loaded ${models.length} pre-defined models for templates`);

        // Load user templates if logged in
        if (currentUser) {
          const user = await loadUserTemplates(currentUser.uid);
          setUserTemplates(user);
          console.log(`Loaded ${user.length} user templates`);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [currentUser]);

  const handleCreateTemplate = () => {
    setIsCreateTemplateModalOpen(true);
  };

  const handleCreateFolder = () => {
    setIsCreateFolderModalOpen(true);
  };

  const handleAddItem = () => {
    setIsAddItemModalOpen(true);
  };

  const handleSaveTemplate = async (templateData: any) => {
    if (!currentUser) {
      console.error('User not logged in');
      return;
    }

    try {
      console.log('Creating template:', templateData);
      const templateId = await createTemplate(currentUser.uid, {
        name: templateData.name,
        description: templateData.description,
        type: templateData.type,
        gender: templateData.gender,
        category: templateData.category,
        thumbnail: templateData.thumbnail,
        modelId: templateData.modelId,
        wardrobeItemIds: templateData.wardrobeItemIds,
        tags: [],
      });

      // Reload user templates
      const updatedTemplates = await loadUserTemplates(currentUser.uid);
      setUserTemplates(updatedTemplates);
      console.log('Template created successfully:', templateId);
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleSaveFolder = (folderData: any) => {
    console.log('Folder created:', folderData);
    setCustomCollections(prev => [...prev, folderData.name]);
    // TODO: Save folder to database/storage
  };

  const handleAddTemplateItem = (templateData: any) => {
    console.log('Template item added:', templateData);
    // TODO: Process imported template
  };

  const handleGenderFilterToggle = (gender: GenderFilter) => {
    setSelectedGenderFilters(prev =>
      prev.includes(gender)
        ? prev.filter(g => g !== gender)
        : [...prev, gender]
    );
  };

  const handleWardrobeFilterToggle = (category: string) => {
    setSelectedWardrobeFilters(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Determine if filter should be visible
  const showFilter = selectedSection === 'user';

  // Quick filter options for Pre-Defined section
  const quickFilterOptions = selectedSection === 'predefined'
    ? (activeCategory === 'models'
      ? ['Male', 'Female', 'Non-Binary']
      : ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Footwear', 'Accessories'])
    : [];

  const handleQuickFilterToggle = (filter: string) => {
    setSelectedQuickFilter(prev => prev === filter ? null : filter);
  };

  // Get active filters display
  const activeFilterCount = activeCategory === 'models'
    ? selectedGenderFilters.length
    : selectedWardrobeFilters.length;

  // Filter pre-defined models based on selected quick filter
  const filteredPredefinedModels = selectedSection === 'predefined' && activeCategory === 'models'
    ? (selectedQuickFilter
      ? predefinedModels.filter(model => {
        const genderMap: { [key: string]: string } = {
          'Male': 'male',
          'Female': 'female',
          'Non-Binary': 'non-binary'
        };
        return model.gender === genderMap[selectedQuickFilter];
      })
      : predefinedModels)
    : [];

  return (
    <div className="w-full h-full flex flex-col relative bg-[#111111]">
      {/* Header */}
      <div className="h-14 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-20">
        <h1 className="text-[15px] font-medium text-white/90">Collections</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex min-h-0">
        {/* Sidebar */}
        <div className="w-64 bg-white/5 border-r border-white/5 flex flex-col flex-shrink-0 h-full overflow-y-auto">
          <div className="p-4 space-y-3">
            {/* Create Collection Button */}
            <button
              onClick={handleCreateTemplate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black text-[13px] font-semibold rounded-lg transition-colors shadow-lg"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Create Collection
            </button>

            {/* Divider */}
            <div className="h-px bg-white/5"></div>

            {/* USER DEFINED Section */}
            <div className="space-y-1">
              <div
                onClick={() => setIsUserDefinedExpanded(!isUserDefinedExpanded)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 py-2 hover:text-gray-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span>User Defined</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateFolder();
                    }}
                    className="p-0.5 hover:bg-white/10 rounded"
                    title="Create folder"
                  >
                    <FolderPlusIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddItem();
                    }}
                    className="p-0.5 hover:bg-white/10 rounded"
                    title="Add item"
                  >
                    <FilePlusIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isUserDefinedExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </div>

              {isUserDefinedExpanded && (
                <div className="pl-3 space-y-1">
                  <button
                    onClick={() => {
                      setActiveCategory('models');
                      setSelectedSection('user');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeCategory === 'models' && selectedSection === 'user'
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Models
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('wardrobe');
                      setSelectedSection('user');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeCategory === 'wardrobe' && selectedSection === 'user'
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Wardrobe
                  </button>
                  {customCollections.map((collection, idx) => (
                    <button
                      key={idx}
                      className="w-full text-left px-3 py-2 rounded text-sm transition-colors text-gray-400 hover:text-white hover:bg-white/5"
                    >
                      {collection}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5"></div>

            {/* PRE-DEFINED Section */}
            <div className="space-y-1">
              <button
                onClick={() => setIsPreDefinedExpanded(!isPreDefinedExpanded)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2 py-2 hover:text-gray-400 transition-colors"
              >
                <span>Pre-Defined</span>
                {isPreDefinedExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {isPreDefinedExpanded && (
                <div className="pl-3 space-y-1">
                  <button
                    onClick={() => {
                      setActiveCategory('models');
                      setSelectedSection('predefined');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeCategory === 'models' && selectedSection === 'predefined'
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Models
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('wardrobe');
                      setSelectedSection('predefined');
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeCategory === 'wardrobe' && selectedSection === 'predefined'
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    Wardrobe
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#111111] flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-md px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-white/10 transition-colors"
                />
              </div>

              {/* Quick Filter Pills - Only for Pre-Defined section */}
              {selectedSection === 'predefined' && quickFilterOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  {quickFilterOptions.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => handleQuickFilterToggle(filter)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${selectedQuickFilter === filter
                        ? 'bg-blue-500/20 text-blue-200 border-blue-500/30 shadow-sm'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                        }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}

              {/* Filter Button - Only visible for User Defined section */}
              {showFilter && (
                <div ref={filterDropdownRef} className="relative">
                  <button
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-2 ${activeFilterCount > 0 || isFilterDropdownOpen
                      ? 'bg-white/10 text-white border border-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    title="Filter collections"
                  >
                    <FilterIcon className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                      <span className="text-[10px] font-semibold">{activeFilterCount}</span>
                    )}
                  </button>

                  {/* Filter Dropdown */}
                  <AnimatePresence>
                    {isFilterDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute right-0 mt-2 w-48 bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 origin-top-right"
                      >
                        <div className="p-2.5 border-b border-white/10">
                          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            Filter by {activeCategory === 'models' ? 'Gender' : 'Category'}
                          </h3>
                        </div>
                        <div className="p-2 space-y-1">
                          {activeCategory === 'models' ? (
                            // Gender filters for Models
                            <>
                              <button
                                onClick={() => handleGenderFilterToggle('male')}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${selectedGenderFilters.includes('male')
                                  ? 'bg-white/10 text-white border border-white/10'
                                  : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200'
                                  }`}
                              >
                                Male
                              </button>
                              <button
                                onClick={() => handleGenderFilterToggle('female')}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${selectedGenderFilters.includes('female')
                                  ? 'bg-white/10 text-white border border-white/10'
                                  : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200'
                                  }`}
                              >
                                Female
                              </button>
                              <button
                                onClick={() => handleGenderFilterToggle('lgbtq+')}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${selectedGenderFilters.includes('lgbtq+')
                                  ? 'bg-white/10 text-white border border-white/10'
                                  : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200'
                                  }`}
                              >
                                LGBTQ+
                              </button>
                            </>
                          ) : (
                            // Category filters for Wardrobe
                            <>
                              {wardrobeCategories.length > 0 ? (
                                wardrobeCategories.map(category => (
                                  <button
                                    key={category}
                                    onClick={() => handleWardrobeFilterToggle(category)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${selectedWardrobeFilters.includes(category)
                                      ? 'bg-white/10 text-white border border-white/10'
                                      : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200'
                                      }`}
                                  >
                                    {category}
                                  </button>
                                ))
                              ) : (
                                <p className="text-xs text-gray-400 px-2.5 py-1.5 text-center">
                                  No categories available
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        {activeFilterCount > 0 && (
                          <div className="p-2.5 border-t border-white/10">
                            <button
                              onClick={() => {
                                setSelectedGenderFilters([]);
                                setSelectedWardrobeFilters([]);
                              }}
                              className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              Clear All Filters
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                <LayoutIcon className="w-4 h-4" />
              </button>
              <span>
                {selectedSection === 'predefined' && activeCategory === 'models'
                  ? `${filteredPredefinedModels.length} models`
                  : selectedSection === 'user'
                    ? `${2 + customCollections.length} collections`
                    : `${templates.length} collections`}
              </span>
            </div>
          </div>

          {/* Template Grid/List */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Pre-Defined Models View */}
            {selectedSection === 'predefined' && activeCategory === 'models' && (
              <>
                {filteredPredefinedModels.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="flex items-center justify-center mx-auto mb-8">
                      <LayoutIcon className="w-16 h-16 text-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                    </div>
                    <h3 className="text-xl font-sans font-semibold text-white mb-3">
                      No Pre-Defined Models Yet
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
                      Pre-defined models from the library will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Group models by base model (for now, each model is its own row) */}
                    {filteredPredefinedModels.map((model) => (
                      <div key={model.id} className="space-y-3">
                        {/* Model Row */}
                        <div className="flex items-start gap-4">
                          {/* Model Thumbnail */}
                          <div
                            className="group relative cursor-pointer"
                            onClick={() => setSelectedModel(model)}
                          >
                            <div className="w-32 h-48 bg-white/5 rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all hover:shadow-lg">
                              <img
                                src={model.thumbnail || model.url}
                                alt={model.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {/* Tags below thumbnail */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {model.tags.slice(0, 2).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-full border border-white/5"
                                >
                                  {tag}
                                </span>
                              ))}
                              {model.tags.length > 2 && (
                                <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-full border border-white/5">
                                  +{model.tags.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Variations would go here in the future */}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* User-Defined Models and Wardrobe */}
            {!(selectedSection === 'predefined' && activeCategory === 'models') && (
              <>
                {selectedSection === 'user' && activeCategory === 'models' ? (
                  <UserModelsCollectionView currentUser={currentUser} />
                ) : selectedSection === 'user' && activeCategory === 'wardrobe' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="flex items-center justify-center mx-auto mb-8">
                      <LayoutIcon className="w-16 h-16 text-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                    </div>
                    <h3 className="text-xl font-sans font-semibold text-white mb-3">
                      Wardrobe Collection
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
                      Your wardrobe items from all projects will appear here.
                    </p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="flex items-center justify-center mx-auto mb-8">
                      <LayoutIcon className="w-16 h-16 text-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
                    </div>
                    <h3 className="text-xl font-sans font-semibold text-white mb-3">
                      No {selectedSection === 'user' ? 'User-Defined' : 'Pre-Defined'} Collections Yet
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto mb-6">
                      {selectedSection === 'user'
                        ? 'Create your first custom collection to get started. Collections help you reuse models and wardrobes across projects.'
                        : 'Pre-defined collections from the library will appear here.'}
                    </p>
                    {selectedSection === 'user' && (
                      <button
                        onClick={handleCreateTemplate}
                        className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black text-[13px] font-semibold rounded-lg transition-colors flex items-center gap-2"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Create Your First Collection
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                        : 'space-y-2'
                    }
                  >
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`group relative ${viewMode === 'grid'
                          ? 'aspect-[3/4] bg-white/5 rounded-lg border border-white/5 hover:border-white/10 overflow-hidden cursor-pointer transition-all hover:scale-105'
                          : 'flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 cursor-pointer transition-colors'
                          }`}
                      >
                        {/* Template card content would go here */}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateTemplateModal
        isOpen={isCreateTemplateModalOpen}
        onClose={() => setIsCreateTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        templateType={activeCategory}
        wardrobeCategories={wardrobeCategories}
      />
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onSave={handleSaveFolder}
      />
      <AddTemplateItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        onAdd={handleAddTemplateItem}
      />

      {/* Model Detail Modal */}
      <AnimatePresence>
        {selectedModel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedModel(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Main Image Area */}
              <div className="flex-1 flex items-center justify-center bg-black/40 p-8 relative">
                <img
                  src={selectedModel.url}
                  alt={selectedModel.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Sidebar with Metadata */}
              <div className="w-80 bg-white/5 border-l border-white/10 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-lg font-medium text-white/90 mb-2">{selectedModel.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 bg-white/10 text-gray-200 rounded-full border border-white/5 capitalize font-medium">
                      {selectedModel.gender}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* ID */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Model ID</h3>
                    <p className="text-sm text-gray-200 font-mono bg-white/5 p-2 rounded border border-white/5">{selectedModel.id}</p>
                  </div>

                  {/* Gender */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Gender</h3>
                    <p className="text-sm text-gray-200 capitalize">{selectedModel.gender}</p>
                  </div>

                  {/* Tags */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-1 bg-white/5 text-gray-300 rounded-full border border-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* URL */}
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Image URL</h3>
                    <p className="text-[10px] text-gray-400 break-all font-mono leading-relaxed">{selectedModel.url}</p>
                  </div>

                  {/* Thumbnail URL if different */}
                  {selectedModel.thumbnail && selectedModel.thumbnail !== selectedModel.url && (
                    <div>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Thumbnail URL</h3>
                      <p className="text-[10px] text-gray-400 break-all font-mono leading-relaxed">{selectedModel.thumbnail}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 bg-white/5">
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg transition-colors font-medium text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Templates;
