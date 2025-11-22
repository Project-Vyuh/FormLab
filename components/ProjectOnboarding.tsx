/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import CreateProjectModal from './CreateProjectModal';
import { Project } from '../types';
import { saveProjectMetadata } from '../services/dbService';
import { CubeIcon } from './icons';

interface ProjectOnboardingProps {
  onProjectCreated: (project: Project) => void;
}

const ProjectOnboarding: React.FC<ProjectOnboardingProps> = ({ onProjectCreated }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateProject = async (projectName: string) => {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      title: projectName,
      description: '',
      organization: '',
      clientDetails: { name: '', email: '', phone: '', location: '' },
      createdAt: new Date().toISOString(),
      deadline: '',
      tags: [],
      status: 'Draft',
    };

    try {
      await saveProjectMetadata(newProject);
      setIsModalOpen(false);
      onProjectCreated(newProject);
    } catch (e) {
      console.error("Failed to save first project", e);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] p-4">
      <div className="text-center max-w-lg mx-auto">
        <div className="flex items-center justify-center mx-auto mb-8">
          <CubeIcon className="w-16 h-16 text-gray-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]" />
        </div>
        <h2 className="text-xl font-sans font-semibold text-white mb-3">Welcome to FormLab</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
          To get started, you need to create a project. Projects help you organize your models, styles, and creative assets.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-8 px-6 py-2 text-xs font-medium text-white bg-[#318CE7] rounded-lg hover:bg-[#2b7bc0] transition-all shadow-lg shadow-blue-500/20"
        >
          Create Your First Project
        </button>
      </div>
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default ProjectOnboarding;