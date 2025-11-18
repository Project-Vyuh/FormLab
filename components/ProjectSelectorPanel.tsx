/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Project } from '../types';
import { PenLineIcon, PlusIcon } from './icons';

interface ProjectSelectorPanelProps {
  projects: Project[];
  currentProjectId: string | null;
  onProjectChange: (id: string) => void;
  onEditProject: () => void;
  onCreateProject: () => void;
  isCreateDisabled?: boolean;
}

const ProjectSelectorPanel: React.FC<ProjectSelectorPanelProps> = ({
  projects,
  currentProjectId,
  onProjectChange,
  onEditProject,
  onCreateProject,
  isCreateDisabled = false,
}) => {
  return (
    <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">Project</h3>
        <div className="flex items-center gap-2">
            <select
                value={currentProjectId || ''}
                onChange={(e) => onProjectChange(e.target.value)}
                className="w-full text-sm p-2 bg-black/30 border border-gray-700 text-gray-200 rounded-md"
                disabled={projects.length === 0}
            >
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                {projects.length === 0 && <option>No projects yet</option>}
            </select>
            <button
                onClick={onEditProject}
                className="p-2 rounded-md bg-black/30 border border-gray-700 text-gray-300 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit Project"
                disabled={!currentProjectId}
            >
                <PenLineIcon className="w-4 h-4" />
            </button>
            <button
                onClick={onCreateProject}
                className="p-2 rounded-md bg-black/30 border border-gray-700 text-gray-300 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isCreateDisabled ? "Create new projects in the Create Model screen" : "New Project"}
                disabled={isCreateDisabled}
            >
                <PlusIcon className="w-4 h-4" />
            </button>
        </div>
    </div>
  );
};

export default ProjectSelectorPanel;