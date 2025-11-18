/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, DependencyList } from 'react';

export const useDebouncedEffect = (
  effect: () => void,
  deps: DependencyList,
  delay: number
) => {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), delay]);
};
