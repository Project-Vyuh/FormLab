/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Project } from '../types';
import { PenLineIcon, PlusIcon, FolderIcon } from './icons';

interface ProjectSelectorPanelProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onEditProject: () => void;
  onCreateProject: () => void;
  onOpenSwitchModal: () => void;
  isCreateDisabled?: boolean;
}

const ProjectSelectorPanel: React.FC<ProjectSelectorPanelProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  onEditProject,
  onCreateProject,
  onOpenSwitchModal,
  isCreateDisabled = false,
}) => {
  const currentProject = projects.find(p => p.id === currentProjectId);

  return (
    <div className="flex-shrink-0 p-4 border-b border-white/5">
      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
        <FolderIcon className="w-3.5 h-3.5 text-gray-600" />
        Project
      </h3>
      <div className="flex items-center gap-2">
        <div className="flex-grow flex items-center justify-between p-2 bg-white/5 border border-white/10 rounded-lg min-w-0 h-[34px]">
          <span className="truncate font-medium text-xs text-gray-200">{currentProject?.title || 'Select Project...'}</span>
          <button
            onClick={onOpenSwitchModal}
            disabled={projects.length === 0}
            className="ml-2 text-[10px] font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 px-2 py-0.5 rounded transition-all whitespace-nowrap"
          >
            Switch
          </button>
        </div>
        <button
          onClick={onCreateProject}
          className="h-[34px] w-[34px] flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title={isCreateDisabled ? "Create new projects in the Create Model screen" : "New Project"}
          disabled={isCreateDisabled}
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ProjectSelectorPanel;