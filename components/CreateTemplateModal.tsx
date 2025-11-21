/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadCloudIcon } from './icons';

type TemplateType = 'models' | 'wardrobe';
type GenderFilter = 'male' | 'female' | 'lgbtq+';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (templateData: {
    name: string;
    description: string;
    type: TemplateType;
    gender?: GenderFilter;
    category?: string;
    thumbnail: File;
  }) => void;
  templateType: TemplateType;
  wardrobeCategories: string[];
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  templateType,
  wardrobeCategories,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<GenderFilter>('male');
  const [category, setCategory] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setName('');
    setDescription('');
    setGender('male');
    setCategory(wardrobeCategories[0] || '');
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }, [wardrobeCategories]);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    if (wardrobeCategories.length > 0 && !category) {
      setCategory(wardrobeCategories[0]);
    }
  }, [wardrobeCategories, category]);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const selectedFile = files[0];
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
      }
      setError(null);
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));

      // Pre-fill name from filename if empty
      if (!name) {
        const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
        setName(nameWithoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    handleFileChange(event.dataTransfer.files);
  }, []);

  const onDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const handleSubmit = () => {
    if (!name.trim() || !file) {
      setError('Please provide a collection name and thumbnail image.');
      return;
    }

    const templateData: any = {
      name: name.trim(),
      description: description.trim(),
      type: templateType,
      thumbnail: file,
    };

    if (templateType === 'models') {
      templateData.gender = gender;
    } else {
      templateData.category = category;
    }

    onSave(templateData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-[#2a2a2a] rounded-2xl w-full max-w-2xl flex flex-col shadow-xl border border-gray-700 max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-sans font-semibold text-gray-200">
                Create {templateType === 'models' ? 'Model' : 'Wardrobe'} Collection
              </h2>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 grid grid-cols-2 gap-6 overflow-y-auto flex-1">
              {/* Left column - Thumbnail */}
              <div className="col-span-1">
                <p className="text-sm font-medium text-gray-300 mb-2 block">Collection Thumbnail</p>
                <label
                  htmlFor="template-thumbnail-upload"
                  className="relative w-full aspect-square border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300 cursor-pointer"
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Collection preview" className="w-full h-full object-cover rounded-md" />
                  ) : (
                    <>
                      <UploadCloudIcon className="w-12 h-12 mb-3" />
                      <span className="text-sm text-center font-medium px-4">
                        Drag & drop or click to upload
                      </span>
                      <span className="text-xs text-gray-500 mt-2">PNG, JPG, WEBP</span>
                    </>
                  )}
                </label>
                <input
                  id="template-thumbnail-upload"
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
              </div>

              {/* Right column - Form fields */}
              <div className="col-span-1 space-y-4">
                {/* Template Name */}
                <div>
                  <label htmlFor="template-name" className="text-sm font-medium text-gray-300 block mb-1">
                    Collection Name *
                  </label>
                  <input
                    type="text"
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Summer Casual Look"
                    className="w-full p-2 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="template-description" className="text-sm font-medium text-gray-300 block mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    id="template-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add details about this collection..."
                    rows={3}
                    className="w-full p-2 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Conditional fields based on template type */}
                {templateType === 'models' ? (
                  // Gender selection for Model templates
                  <div>
                    <label htmlFor="template-gender" className="text-sm font-medium text-gray-300 block mb-1">
                      Gender *
                    </label>
                    <select
                      id="template-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as GenderFilter)}
                      className="w-full p-2 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="lgbtq+">LGBTQ+</option>
                    </select>
                  </div>
                ) : (
                  // Category selection for Wardrobe templates
                  <div>
                    <label htmlFor="template-category" className="text-sm font-medium text-gray-300 block mb-1">
                      Category *
                    </label>
                    <select
                      id="template-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    >
                      {wardrobeCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Info text */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs text-blue-300">
                    {templateType === 'models'
                      ? 'Model collections help you quickly reuse favorite model configurations across projects.'
                      : 'Wardrobe collections allow you to save complete outfit combinations for easy reuse.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="px-6 pb-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end items-center gap-3 p-4 bg-[#1a1a1a] border-t border-gray-700 rounded-b-2xl flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!name.trim() || !file}
              >
                Create Collection
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateTemplateModal;
