import {aiGateway} from './aiGateway';
import {localAssetId,uploadAsset,mediaFetchOptions,sessionScope} from './localApi';
import {getGenerationPromptSuffix} from './geminiService';
import {GenerationSettings,HistoryItemType} from '../types';
export async function runLocalImageWorkflow(input:{projectId:string;type:HistoryItemType;parentId:string|null;baseModelId:string;prompt:string;settings:GenerationSettings;model:string;modelName:string;references:string[]}){
  const scope=sessionScope(),parts:any[]=[];
  if(input.references.length>12)throw Error('Use at most 12 image references');
  for(const url of input.references){let id=localAssetId(url);if(!id){const response=await fetch(url,{...mediaFetchOptions(url),signal:scope.signal});if(!response.ok)throw Error('Reference image could not be loaded');id=(await uploadAsset(await response.blob())).id;}scope.assert();parts.push({assetId:id});}
  const historyId=`hist-${crypto.randomUUID()}`;
  const history={id:historyId,parentId:input.parentId,baseModelId:input.baseModelId||historyId,prompt:input.prompt,type:input.type,settings:input.settings,modelName:input.modelName};
  const prompt=`Create one photorealistic fashion studio image. Preserve the identity and proportions of the subject in the first reference. Additional references are garments or additional subjects as specified in the task. Never add text or watermarks.\nTask: ${input.prompt}\nCreative controls:\n${getGenerationPromptSuffix(input.settings)}`;
  parts.push({text:prompt});
  await aiGateway.models.generateContent({model:input.model,contents:[{role:'user',parts}],config:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:input.settings.aspectRatio,imageSize:input.settings.imageSize==='1K'?'1K':'2K'}},attachment:{projectId:input.projectId,history}});
  scope.assert();return {historyId};
}
