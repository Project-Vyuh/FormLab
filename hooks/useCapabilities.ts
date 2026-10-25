import {useEffect,useState} from 'react';
import {localRequest} from '../services/localApi';
import {isLocalMode} from '../services/runtimeConfig';
export function useCapabilities(){
  const [capabilities,setCapabilities]=useState({imageSizes:isLocalMode?['1K','2K']:['1K','2K','4K'],videoEnabled:false});
  useEffect(()=>{if(!isLocalMode)return;let alive=true;void localRequest<typeof capabilities>('/api/capabilities').then(result=>{if(alive)setCapabilities(result);}).catch(()=>{});return()=>{alive=false;};},[]);
  return capabilities;
}
