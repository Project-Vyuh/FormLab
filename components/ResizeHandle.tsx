/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onMouseDown }) => {
  return (
    <div
      className="w-1.5 h-full cursor-col-resize bg-transparent hover:bg-gray-300/80 dark:hover:bg-gray-600/80 transition-colors duration-200 flex-shrink-0"
      onMouseDown={onMouseDown}
    />
  );
};

export default ResizeHandle;