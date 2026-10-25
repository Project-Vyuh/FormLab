import {problem} from './config.mjs';
// Gemini's schema uses uppercase type names; validate the subset accepted by the app.
export function assertJsonContract(value,schema,depth=0){
  if(!schema)return;
  if(depth>32)throw problem(502,'INVALID_OUTPUT','Output nesting exceeds limits');
  const fail=()=>{throw problem(502,'INVALID_OUTPUT','Output does not satisfy the requested schema');};
  if(value===null&&schema.nullable)return;
  const type=String(schema.type||'').toLowerCase();
  if(type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value))fail();
    for(const key of schema.required||[])if(!Object.hasOwn(value,key))fail();
    for(const [key,definition]of Object.entries(schema.properties||{}))if(Object.hasOwn(value,key))assertJsonContract(value[key],definition,depth+1);
  }else if(type==='array'){
    if(!Array.isArray(value)||value.length>10000||(schema.minItems!==undefined&&value.length<schema.minItems)||(schema.maxItems!==undefined&&value.length>schema.maxItems))fail();
    for(const item of value)assertJsonContract(item,schema.items,depth+1);
  }else if(type==='string'){
    if(typeof value!=='string'||(schema.minLength!==undefined&&value.length<schema.minLength)||(schema.maxLength!==undefined&&value.length>schema.maxLength))fail();
  }else if(type==='number'||type==='integer'){
    if(typeof value!=='number'||!Number.isFinite(value)||(type==='integer'&&!Number.isInteger(value))||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum))fail();
  }else if(type==='boolean'&&typeof value!=='boolean')fail();
  if(schema.enum&&!schema.enum.includes(value))fail();
}
