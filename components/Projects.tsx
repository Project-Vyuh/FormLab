/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { LayoutIcon } from './icons';

const Projects: React.FC = () => {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-[#1a1a1a]">
      <div className="text-center">
        <LayoutIcon className="w-16 h-16 text-gray-700 mx-auto mb-6"/>
        <h2 className="text-4xl font-sans font-semibold text-gray-200">Projects Dashboard</h2>
        <p className="text-lg text-gray-400 mt-4">Manage all your brand projects from one place.</p>
        <p className="text-gray-500 mt-2">This feature is coming soon.</p>
      </div>
    </div>
  );
};

export default Projects;