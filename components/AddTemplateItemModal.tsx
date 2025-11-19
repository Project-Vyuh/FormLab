/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadCloudIcon, FileIcon } from './icons';

type ImportMethod = 'file' | 'json';

interface AddTemplateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (templateData: { file?: File; jsonData?: string; method: ImportMethod }) => void;
}

const AddTemplateItemModal: React.FC<AddTemplateItemModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [importMethod, setImportMethod] = useState<ImportMethod>('file');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setImportMethod('file');
    setFile(null);
    setPreviewUrl(null);
    setJsonData('');
    setError(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const selectedFile = files[0];

      // Accept both images and JSON files
      const isImage = selectedFile.type.startsWith('image/');
      const isJSON = selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json');

      if (!isImage && !isJSON) {
        setError('Please select an image or JSON file.');
        return;
      }

      setError(null);
      setFile(selectedFile);

      if (isImage) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        // Read JSON file content
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setJsonData(content);
        };
        reader.readAsText(selectedFile);
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
    if (importMethod === 'file' && !file) {
      setError('Please select a file to import.');
      return;
    }

    if (importMethod === 'json' && !jsonData.trim()) {
      setError('Please provide JSON data to import.');
      return;
    }

    // Validate JSON if importing via JSON
    if (importMethod === 'json') {
      try {
        JSON.parse(jsonData);
      } catch (e) {
        setError('Invalid JSON format. Please check your data.');
        return;
      }
    }

    onAdd({
      file: importMethod === 'file' ? file || undefined : undefined,
      jsonData: importMethod === 'json' ? jsonData : undefined,
      method: importMethod,
    });
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
              <h2 className="text-xl font-sans font-semibold text-gray-200">Add Existing Template</h2>
              <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Import Method Selector */}
            <div className="p-6 border-b border-gray-700 flex-shrink-0">
              <p className="text-sm font-medium text-gray-300 mb-3">Import Method</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportMethod('file')}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    importMethod === 'file'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-300'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <UploadCloudIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Upload File</span>
                  </div>
                  <p className="text-xs mt-1 opacity-70">Import from image or JSON file</p>
                </button>
                <button
                  onClick={() => setImportMethod('json')}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    importMethod === 'json'
                      ? 'bg-blue-500/10 border-blue-500 text-blue-300'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FileIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Paste JSON</span>
                  </div>
                  <p className="text-xs mt-1 opacity-70">Paste template JSON data</p>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {importMethod === 'file' ? (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-3">Select File</p>
                  <label
                    htmlFor="template-file-upload"
                    className="relative w-full aspect-[2/1] border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-300 cursor-pointer"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Template preview" className="w-full h-full object-contain rounded-md" />
                    ) : file ? (
                      <div className="flex flex-col items-center">
                        <FileIcon className="w-16 h-16 mb-3 text-blue-400" />
                        <span className="text-sm font-medium text-gray-200">{file.name}</span>
                        <span className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    ) : (
                      <>
                        <UploadCloudIcon className="w-16 h-16 mb-4" />
                        <span className="text-sm text-center font-medium px-4 mb-2">
                          Drag & drop or click to upload
                        </span>
                        <span className="text-xs text-gray-500">
                          Supports: PNG, JPG, WEBP, JSON
                        </span>
                      </>
                    )}
                  </label>
                  <input
                    id="template-file-upload"
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp, application/json, .json"
                    onChange={(e) => handleFileChange(e.target.files)}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-3">Template JSON Data</p>
                  <textarea
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    placeholder='Paste your template JSON data here...\n\nExample:\n{\n  "name": "Template Name",\n  "type": "models",\n  "gender": "female",\n  ...\n}'
                    rows={12}
                    className="w-full p-4 bg-black/30 border border-gray-700 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
                  />
                  <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-400">
                      Paste the JSON data exported from another template. The format will be validated before import.
                    </p>
                  </div>
                </div>
              )}
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
                disabled={(importMethod === 'file' && !file) || (importMethod === 'json' && !jsonData.trim())}
              >
                Add Template
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddTemplateItemModal;
