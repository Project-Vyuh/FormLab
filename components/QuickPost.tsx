/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

const QuickPost: React.FC = () => {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-[#EEEEEE] dark:bg-[#1a1a1a]">
      <div className="text-center">
        <h2 className="text-4xl font-sans font-semibold text-gray-800 dark:text-gray-200">QuickPost</h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-4">Generate social media content in seconds.</p>
        <p className="text-gray-500 dark:text-gray-500 mt-2">This feature is coming soon.</p>
      </div>
    </div>
  );
};

export default QuickPost;