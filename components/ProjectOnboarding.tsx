/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import ProjectModal from './ProjectModal';
import { Project } from '../types';
import { saveProjectMetadata } from '../services/dbService';
import { CubeIcon } from './icons';

interface ProjectOnboardingProps {
  onProjectCreated: (project: Project) => void;
}

const ProjectOnboarding: React.FC<ProjectOnboardingProps> = ({ onProjectCreated }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSaveProject = async (projectData: Project) => {
    try {
      await saveProjectMetadata(projectData);
      setIsModalOpen(false);
      onProjectCreated(projectData);
    } catch (e) {
      console.error("Failed to save first project", e);
      // Future enhancement: show an error toast to the user.
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] p-4">
      <div className="text-center">
        <CubeIcon className="w-16 h-16 text-gray-700 mx-auto mb-6" />
        <h2 className="text-4xl font-sans font-semibold text-gray-200">Welcome to FormLab</h2>
        <p className="text-lg text-gray-400 mt-4 max-w-md">
          To get started, you need to create a project. Projects help you organize your models, styles, and creative assets.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-8 px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Create Your First Project
        </button>
      </div>
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProject}
        mode="create"
      />
    </div>
  );
};

export default ProjectOnboarding;