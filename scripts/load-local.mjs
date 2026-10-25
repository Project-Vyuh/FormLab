import {spawn} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import sharp from 'sharp';
const seconds=Number(process.argv[2]||60);
if(!Number.isInteger(seconds)||seconds<10||seconds>600)throw Error('Duration must be 10–600 seconds');
const directory=await mkdtemp(join(tmpdir(),'formlab-load-')),port=22000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
const image=await sharp(randomBytes(512*512*3),{raw:{width:512,height:512,channels:3}}).png().toBuffer();
const fixture=join(directory,'fixture.png');await writeFile(fixture,image,{mode:0o600});
const child=spawn(process.execPath,['--max-old-space-size=192','server/index.mjs'],{env:{...process.env,GEMINI_API_KEY:'',FORMLAB_ENV_FILE:'',FORMLAB_AI_PROVIDER:'fake',FORMLAB_API_PORT:String(port),FORMLAB_DATA_DIR:join(directory,'data'),FORMLAB_ALLOW_REGISTRATION:'true',FORMLAB_FAKE_DELAY_MS:'450',FORMLAB_FAKE_IMAGE_PATH:fixture,FORMLAB_MAX_ASSET_BYTES:'2097152',FORMLAB_WORKERS:'2',FORMLAB_MEMORY_BUDGET_BYTES:'134217728',FORMLAB_MAX_RSS_BYTES:'268435456',FORMLAB_DAILY_BUDGET_UNITS:'1000',FORMLAB_DAILY_JOB_LIMIT:'1000'},stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',d=>stderr=(stderr+d).slice(-4000));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,cookie,body,headers={}){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'x-formlab-client':'web',...(cookie?{cookie}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{}),...headers},...(body?{body:Buffer.isBuffer(body)?body:JSON.stringify(body)}:{})});
  const value=await response.json();return {status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const durations=[],rss=[];let succeeded=0,rejected=0,failures=0,completed=false;
try{
  for(let i=0;i<100;i++){try{if((await api('/api/ready')).status===200)break;}catch{}if(child.exitCode!==null)throw Error('Load server exited during startup');await delay(100);}
  const actors=[];
  for(let i=0;i<4;i++){
    const account=await api('/api/auth/register',null,{email:`load-${i}@example.test`,password:randomBytes(24).toString('hex')});if(account.status!==201)throw Error('Load account setup failed');
    const asset=await api('/api/assets',account.cookie,image,{'content-type':'image/png'});if(asset.status!==201)throw Error('Load asset setup failed');actors.push({cookie:account.cookie,asset:asset.value.id});
  }
  const deadline=Date.now()+seconds*1000;
  await Promise.all(actors.map(async actor=>{
    while(Date.now()<deadline){
      const began=Date.now(),key=randomUUID();
      const accepted=await api('/api/ai/generate-content',actor.cookie,{model:'gemini-2.5-flash-image',contents:[{assetId:actor.asset},{text:'Load fixture'}],config:{responseModalities:['IMAGE']}},{'x-idempotency-key':key});
      if(accepted.status===429||accepted.status===503){rejected++;await delay(4000);continue;}
      if(accepted.status!==202)throw Error(`Unexpected admission HTTP ${accepted.status}`);
      let terminal=false;
      for(let i=0;i<80;i++){
        const job=await api('/api/jobs/'+accepted.value.jobId,actor.cookie);
        if(job.value.status==='succeeded'){succeeded++;durations.push(Date.now()-began);terminal=true;break;}
        if(['failed','cancelled'].includes(job.value.status)){failures++;terminal=true;break;}
        await delay(100);
      }
      if(!terminal)throw Error('Load job stalled');
      const metric=await api('/api/metrics',actor.cookie);if(metric.status===200)rss.push(metric.value.process.rssBytes);
      if(rss.at(-1)>384*1024*1024)throw Error('RSS safety watchdog exceeded 384 MiB');
      await delay(Math.max(0,4000-(Date.now()-began)));
    }
  }));
  durations.sort((a,b)=>a-b);
  const result={seconds,actors:4,referenceBytes:image.length,outputFixture:'512x512 RGB PNG',workerConcurrency:2,memoryReservationBudgetMiB:128,rssAdmissionLimitMiB:256,nodeOldSpaceLimitMiB:192,succeeded,rejected,failures,p95Ms:durations[Math.max(0,Math.ceil(durations.length*.95)-1)],minRssMiB:Math.min(...rss)/1048576,maxRssMiB:Math.max(...rss)/1048576,lastRssMiB:rss.at(-1)/1048576,scope:'Synthetic local fake-provider load; not Gemini performance or an OS hard-memory-limit proof'};
  if(failures||succeeded<4||result.maxRssMiB>256||result.p95Ms>10000)throw Error('Local load acceptance failed: '+JSON.stringify(result));
  console.log(JSON.stringify(result,null,2));completed=true;
}finally{
  child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(6000).then(()=>child.kill('SIGKILL'))]);
  if(!completed&&stderr)console.error('Load server diagnostics:',stderr);
}
