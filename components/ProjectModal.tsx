/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, FileTextIcon, BriefcaseIcon, UsersIcon, CalendarIcon, TagIcon, ChevronDownIcon } from './icons';
import { Project } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
  mode: 'create' | 'edit';
  projectData?: Project | null;
}

const projectTemplates = [
  { name: 'E-commerce Campaign', data: { description: 'UGC content for the new e-commerce campaign.', tags: ['e-comm', 'campaign'], status: 'In Progress' as Project['status'] } },
  { name: 'Social Media', data: { description: 'Content for social media channels.', tags: ['social', 'marketing'], status: 'In Progress' as Project['status'] } },
  { name: 'Editorial Lookbook', data: { description: 'High-fashion editorial lookbook.', tags: ['editorial', 'lookbook'], status: 'Draft' as Project['status'] } },
];

const statusOptions: { value: Project['status']; color: string }[] = [
  { value: 'Draft', color: 'bg-gray-500' },
  { value: 'In Progress', color: 'bg-blue-500' },
  { value: 'In Review', color: 'bg-yellow-500' },
  { value: 'On Hold', color: 'bg-purple-500' },
  { value: 'Completed', color: 'bg-green-500' },
];

const CollapsibleSection: React.FC<{ title: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode; }> = ({ title, icon, isOpen, onToggle, children }) => (
    <div className="border-t border-gray-700/60 pt-4">
        <button onClick={onToggle} className="w-full flex justify-between items-center text-sm font-semibold text-gray-200">
            <span className="flex items-center gap-2">{icon} {title}</span>
            <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 space-y-4">{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const TagInput: React.FC<{ value: string[], onChange: (tags: string[]) => void }> = ({ value, onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const newTag = inputValue.trim();
            if (newTag && !value.includes(newTag)) {
                onChange([...value, newTag]);
            }
            setInputValue('');
        }
    };
    const removeTag = (tagToRemove: string) => { onChange(value.filter(tag => tag !== tagToRemove)); };
    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                {value.map(tag => (
                    <div key={tag} className="flex items-center gap-1 bg-gray-600 text-gray-200 text-xs font-medium px-2 py-1 rounded-full">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-white"><XIcon className="w-3 h-3"/></button>
                    </div>
                ))}
            </div>
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="Add tags (e.g., Summer 24, e-comm)" className="w-full p-2 bg-black/30 border border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-500" />
            <p className="text-xs text-gray-500 mt-1">Separate tags with a comma or press Enter.</p>
        </div>
    );
};

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, mode, projectData }) => {
  const getInitialFormData = useCallback(() => ({
    id: `project-${Date.now()}`, title: '', description: '', organization: '',
    clientDetails: { name: '', email: '', phone: '', location: '' },
    createdAt: new Date().toISOString(), deadline: '', tags: [], status: 'Draft' as Project['status'],
  }), []);

  const [formData, setFormData] = useState<Partial<Project>>(getInitialFormData());
  const [openSections, setOpenSections] = useState({ core: true, client: false, org: false });
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
        if (mode === 'edit' && projectData) {
            setFormData(projectData);
        } else {
            setFormData(getInitialFormData());
        }
        setOpenSections({ core: true, client: false, org: false });
        setActiveTemplate(null);
    }
  }, [isOpen, mode, projectData, getInitialFormData]);

  const handleChange = (field: keyof Project, value: any) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const handleClientChange = (field: string, value: string) => { setFormData(prev => ({ ...prev, clientDetails: { ...prev.clientDetails, [field]: value } })) };
  
  const handleTemplateClick = (template: { name: string; data: Partial<Project> }) => {
    if (activeTemplate === template.name) {
        // Deselecting the template
        const initialData = getInitialFormData();
        setFormData(prev => ({
            ...prev,
            description: initialData.description,
            tags: initialData.tags,
            status: initialData.status
        }));
        setActiveTemplate(null);
    } else {
        // Selecting a new template
        setFormData(prev => ({ ...prev, ...template.data }));
        setActiveTemplate(template.name);
    }
  };
  
  const setDeadline = (duration: 'week' | 'month') => {
    const date = new Date();
    if (duration === 'week') { date.setDate(date.getDate() + 7); }
    else if (duration === 'month') { date.setMonth(date.getMonth() + 1); }
    handleChange('deadline', date.toISOString().split('T')[0]);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title) onSave(formData as Project);
  };

  const selectedStatusColor = statusOptions.find(opt => opt.value === formData.status)?.color || 'bg-gray-500';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="relative bg-[#2a2a2a] rounded-2xl w-full max-w-3xl flex flex-col shadow-xl border border-gray-700 max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0"><h2 className="text-xl font-sans font-semibold text-gray-200">{mode === 'create' ? 'Create New Project' : 'Edit Project'}</h2><button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700"><XIcon className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
              <div className="p-6 space-y-6 flex-grow overflow-y-auto">
                {mode === 'create' && (
                    <div>
                        <label className="text-sm font-medium text-gray-300">Start with a template</label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {projectTemplates.map(template => (
                                <button key={template.name} type="button" onClick={() => handleTemplateClick(template)} 
                                className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors ${activeTemplate === template.name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                    {template.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <CollapsibleSection title="Core Details" icon={<FileTextIcon className="w-4 h-4 text-gray-400"/>} isOpen={openSections.core} onToggle={() => setOpenSections(p => ({...p, core: !p.core}))}>
                    <div><label className="text-sm font-medium text-gray-300">Project Title</label><input type="text" value={formData.title || ''} onChange={(e) => handleChange('title', e.target.value)} required placeholder="e.g., Summer 2025 Campaign" className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/></div>
                    <div><label className="text-sm font-medium text-gray-300">Description</label><textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={3} placeholder="UGC content for the new summer collection, focusing on beachwear." className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"></textarea></div>
                </CollapsibleSection>

                <CollapsibleSection title="Organization" icon={<BriefcaseIcon className="w-4 h-4 text-gray-400"/>} isOpen={openSections.org} onToggle={() => setOpenSections(p => ({...p, org: !p.org}))}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium text-gray-300">Organization</label><input type="text" value={formData.organization || ''} onChange={(e) => handleChange('organization', e.target.value)} placeholder="e.g., Your Brand Name Inc." className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/></div>
                        <div>
                            <label className="text-sm font-medium text-gray-300">Status</label>
                            <div className="relative mt-1">
                                <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${selectedStatusColor}`}></span>
                                <select value={formData.status || 'Draft'} onChange={(e) => handleChange('status', e.target.value as Project['status'])} className="w-full p-2 pl-7 bg-black/30 border border-gray-700 rounded-md appearance-none">
                                    {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.value}</option>)}
                                </select>
                                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                            </div>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2"><TagIcon className="w-4 h-4"/> Tags</label>
                        <TagInput value={formData.tags || []} onChange={(tags) => handleChange('tags', tags)} />
                    </div>
                </CollapsibleSection>
                
                <CollapsibleSection title="Client & Scheduling" icon={<UsersIcon className="w-4 h-4 text-gray-400"/>} isOpen={openSections.client} onToggle={() => setOpenSections(p => ({...p, client: !p.client}))}>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Client Details (Optional)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" placeholder="Client Name" value={formData.clientDetails?.name || ''} onChange={e => handleClientChange('name', e.target.value)} className="p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/>
                            <input type="email" placeholder="Client Email (e.g., client@example.com)" value={formData.clientDetails?.email || ''} onChange={e => handleClientChange('email', e.target.value)} className="p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/>
                            <input type="tel" placeholder="Client Phone (e.g., +1 555-123-4567)" value={formData.clientDetails?.phone || ''} onChange={e => handleClientChange('phone', e.target.value)} className="p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/>
                            <input type="text" placeholder="Client Location (e.g., New York, NY)" value={formData.clientDetails?.location || ''} onChange={e => handleClientChange('location', e.target.value)} className="p-2 bg-black/30 border border-gray-700 rounded-md placeholder:text-gray-500"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700/60">
                        <div>
                            <label className="text-sm font-medium text-gray-300">Deadline</label>
                            <input type="date" value={formData.deadline || ''} onChange={(e) => handleChange('deadline', e.target.value)} className="mt-1 w-full p-2 bg-black/30 border border-gray-700 rounded-md"/>
                            <div className="flex gap-2 mt-2">
                                <button type="button" onClick={() => setDeadline('week')} className="text-xs px-2 py-1 bg-gray-600 rounded">1 Week</button>
                                <button type="button" onClick={() => setDeadline('month')} className="text-xs px-2 py-1 bg-gray-600 rounded">1 Month</button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Auto-reminders will be enabled.</p>
                        </div>
                        <div><label className="text-sm font-medium text-gray-300">Date Created</label><p className="mt-1 text-gray-400 p-2">{new Date(formData.createdAt || Date.now()).toLocaleString()}</p></div>
                    </div>
                </CollapsibleSection>

              </div>
              <div className="flex justify-end items-center gap-3 p-4 bg-[#1a1a1a] border-t border-gray-700 rounded-b-2xl flex-shrink-0">
                <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">{mode === 'create' ? 'Create Project' : 'Save Changes'}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProjectModal;