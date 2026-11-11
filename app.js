/* 聊天備份助手 v1.1 — 本機處理，使用者明確授權後才上傳 Google Drive。 */
'use strict';
const DB_NAME='chat_backup_assistant_v1';
const DB_VERSION=1;
const CATEGORIES=['全部','工作','投資','生活','感情','未分類'];
const GROUPS=CATEGORIES.slice(1);
const MAX_LOCAL_ARCHIVE=130*1024*1024; // 儲存大型 ZIP 可能被手機瀏覽器拒絕。
const MAX_EXTRACT_FILE=32*1024*1024;
const MAX_EXTRACT_TOTAL=110*1024*1024;
const MAX_EXPORT_MEMORY=260*1024*1024;
let database;
let chats=[],attachments=[],archives=[];
let activeTab='chats',activeFilter='全部',mediaFilter='全部',openedConversation=null;
let readyBackup=null,backupFile=null,toastTimer=null;
const $=id=>document.getElementById(id);
const fmtTime=v=>{if(!v)return '未知日期';const d=new Date(v);return isNaN(d.getTime())?'未知日期':new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
const fmtSize=n=>n>=1024*1024?`${(n/(1024*1024)).toFixed(1)} MB`:n>=1024?`${Math.round(n/1024)} KB`:`${n} B`;
const escapePath=s=>String(s||'file').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/, '_').slice(0,160);
const arr=a=>Array.isArray(a)?a:[];
function toast(message,ms=4300){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),ms);}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of ['chats','attachments','archives'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function readAll(name){return new Promise((resolve,reject)=>{const req=database.transaction(name,'readonly').objectStore(name).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function txWrite(name,values,mode='put'){if(!values.length)return Promise.resolve();return new Promise((resolve,reject)=>{const tx=database.transaction(name,'readwrite');const store=tx.objectStore(name);for(const value of values)mode==='delete'?store.delete(value):store.put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function reload(){[chats,attachments,archives]=await Promise.all(['chats','attachments','archives'].map(readAll));chats.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));archives.sort((a,b)=>b.importedAt-a.importedAt);attachments.sort((a,b)=>b.importedAt-a.importedAt);$('chatCount').textContent=chats.length.toLocaleString('zh-TW');$('mediaCount').textContent=attachments.length.toLocaleString('zh-TW');$('archiveCount').textContent=archives.length.toLocaleString('zh-TW');$('backupSummary').textContent=`${chats.length} 筆對話・${attachments.length} 個附件・${archives.length} 份原始 ZIP`;renderChats();renderMedia();renderArchives();readyBackup=null;backupFile=null;$('backupCommands').classList.add('hidden');}
function pill(label,sel,onClick){const b=document.createElement('button');b.className='filter'+(label===sel?' active':'');b.textContent=label;b.type='button';b.addEventListener('click',onClick);return b;}
function fillSelect(el,category){el.replaceChildren();for(const c of GROUPS){const opt=document.createElement('option');opt.value=c;opt.textContent=c;el.appendChild(opt);}el.value=GROUPS.includes(category)?category:'未分類';}
function determineCategory(input){const s=String(input||'').toLowerCase();const lists=[['感情',['l+w+s','阿德','阿龍','感情','愛情','男友','abdu','交往']],['投資',['00878','009816','華南金','股票','投資','etf','基金','年終','財務','保單','資產','美股','房貸','車貸']],['工作',['模具','設計變更','圖面','bom','fqc','供應商','報價','開模','工程','公差','點檢','烤漆','廠商','材料']],['生活',['threads','旅行','洗車','冷氣','居家','家人','裝潢','房間','汽車','音樂','斑馬線','醫生','健康','日本']]];for(const [cat,terms] of lists)if(terms.some(w=>s.includes(w)))return cat;return '未分類';}
function textFromPart(p){if(typeof p==='string')return p;if(p===null||p===undefined)return '';if(Array.isArray(p))return p.map(textFromPart).filter(Boolean).join('\n');if(typeof p==='object'){if(typeof p.text==='string')return p.text;if(typeof p.content==='string')return p.content;if(typeof p.caption==='string')return p.caption;if(p.content_type==='audio_transcription'&&typeof p.text==='string')return p.text;const type=p.content_type||p.type||'非文字區塊';const name=p.filename||p.name||p.asset_pointer||p.asset_id||'';return `[${type}${name?'：'+String(name).slice(0,250):''}；請核對原始 ZIP / 附件]`;}return String(p);}
function textFromContent(content){if(!content)return '';if(typeof content==='string')return content;if(Array.isArray(content))return content.map(textFromPart).filter(Boolean).join('\n');if(typeof content==='object'){let pieces=[];if(Array.isArray(content.parts))pieces=content.parts.map(textFromPart);else if(Array.isArray(content.text))pieces=content.text.map(textFromPart);else if(typeof content.text==='string')pieces=[content.text];else if(typeof content.result==='string')pieces=[content.result];else if(content.content_type)pieces=[textFromPart(content)];return pieces.filter(Boolean).join('\n').trim();}return '';}
function asMillis(t){if(t===null||t===undefined)return null;if(typeof t==='string'&&isNaN(Number(t))){const d=Date.parse(t);return isNaN(d)?null:d;}const n=Number(t);if(!Number.isFinite(n))return null;return n<100000000000?n*1000:n;}
function normalizeConversation(c){if(!c||typeof c!=='object')return null;const mapping=c.mapping||{};let ordered=[];const seen=new Set();let nodeId=c.current_node;
 if(nodeId&&mapping[nodeId]){while(nodeId&&mapping[nodeId]&&!seen.has(nodeId)){seen.add(nodeId);ordered.unshift(mapping[nodeId]);nodeId=mapping[nodeId].parent;}}
 if(ordered.length===0)ordered=Object.values(mapping).filter(x=>x&&x.message).sort((a,b)=>(a.message?.create_time||0)-(b.message?.create_time||0));
 if(!ordered.length&&Array.isArray(c.messages))ordered=c.messages.map(message=>({message}));
 const messages=ordered.map(node=>{const m=node.message;if(!m)return null;const role=m.author?.role||m.role||'未知';const text=textFromContent(m.content||m);if(!text)return null;return {role, text, time:asMillis(m.create_time)||null, id:m.id||node.id||null};}).filter(Boolean);
 const title=String(c.title||'未命名對話');const id=String(c.id||c.conversation_id||`${title}-${c.create_time||''}`);const updatedAt=asMillis(c.update_time)||asMillis(c.create_time)||Date.now();
 return {id,title,category:determineCategory(title),createdAt:asMillis(c.create_time)||updatedAt,updatedAt,messages,source:'ChatGPT 官方匯出',importedAt:Date.now()};}
function getRawConversationArray(json){if(Array.isArray(json))return json;if(json&&Array.isArray(json.conversations))return json.conversations;if(json&&Array.isArray(json.data))return json.data;return []}
function normalizeJson(json){const rows=getRawConversationArray(json);if(!rows.length)return [];return rows.map(normalizeConversation).filter(Boolean);}
const isMediaFile=name=>/\.(png|jpe?g|gif|webp|heic|heif|svg|mp3|wav|m4a|aac|ogg|oga|opus|webm|mp4|mov|mkv|pdf|docx?|xlsx?|pptx?|txt|csv|sldprt|sldasm|step|stp|stl|3mf|zip)$/i.test(name);
const mediaKind=name=>/\.(jpe?g|png|gif|webp|heic|heif|svg)$/i.test(name)?'圖片':/\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|mp4|mov|mkv)$/i.test(name)?'錄音／影片':'其他附件';
function iconFor(name){const k=mediaKind(name);return k==='圖片'?'▧':k==='錄音／影片'?'♫':'▤'}
async function importFiles(files){if(!files.length)return;const importButton=$('openImport');importButton.disabled=true;let imported=0,updated=0,mediaNew=0,failures=[],savedSources=0,skippedSources=0,mediaSkip=0;
 try{for(const file of files){let incoming=[];if(/\.zip$/i.test(file.name)){let zip;try{zip=await JSZip.loadAsync(file)}catch(e){failures.push(`${file.name}：無法解開 ZIP`);continue;}
 // 支援重新匯入本工具自己產生的備份包，讓換手機時可還原分類及已保存附件。
 const ownBackup=zip.file('manifest.json')&&zip.file('conversations_normalized.json');
 if(ownBackup){
   try{const data=JSON.parse(await zip.file('conversations_normalized.json').async('string'));
     if(Array.isArray(data))incoming=data.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).map(c=>({...c,importedAt:Date.now(),category:GROUPS.includes(c.category)?c.category:'未分類'}));
   }catch(e){failures.push(`${file.name}：備份包 JSON 無法讀取`);}
   for(const entry of Object.values(zip.files).filter(f=>!f.dir&&f.name.startsWith('official_exports/')&&/\.zip$/i.test(f.name))){
     const size=entry._data?.uncompressedSize??Infinity;
     if(size>MAX_LOCAL_ARCHIVE){skippedSources++;continue;}
     try{const blob=await entry.async('blob');const name=entry.name.split('/').pop().replace(/^\d+_/,'');
       await txWrite('archives',[{id:`restored_${file.name}_${entry.name}`,name,size:blob.size,blob,importedAt:Date.now()}]);savedSources++;
     }catch(e){skippedSources++;}
   }
 }
 const sources=ownBackup?[]:Object.values(zip.files).filter(f=>!f.dir&&/(^|\/)conversations(?:[_-]?\d+)?\.json$/i.test(f.name));
 if(!sources.length&&!ownBackup)failures.push(`${file.name}：未找到 conversations.json，已保留原始 ZIP 的可能性，但無法建立可搜尋聊天索引。`);
 for(const entry of sources){try{if((entry._data?.uncompressedSize??Infinity)>160*1024*1024){failures.push(`${entry.name}：超過手機 JSON 解析上限，請改用電腦。`);continue;}const raw=await entry.async('string');const result=normalizeJson(JSON.parse(raw));incoming.push(...result);}catch(e){failures.push(`${file.name}/${entry.name}：JSON讀取失敗`);}}
 if(!ownBackup&&file.size<=MAX_LOCAL_ARCHIVE){try{const id=`raw_${file.name}_${file.size}_${file.lastModified}`;await txWrite('archives',[{id,name:file.name,size:file.size,blob:file,importedAt:Date.now()}]);savedSources++;}catch(e){skippedSources++;failures.push(`${file.name}：手機本機空間不足，原始 ZIP 未保存。請直接上傳到 Google Drive。`);}}
 else if(!ownBackup){skippedSources++;failures.push(`${file.name} 超過 ${fmtSize(MAX_LOCAL_ARCHIVE)}，未將原始 ZIP 存入本機。請單獨保存到 Google Drive。`);}
 // 原始 ZIP 中確實含有的媒體檔可在容量限制內自動抽取（不保證官方匯出包含全部媒體）。
 let extractedBytes=0;const newFiles=[];
 for(const entry of Object.values(zip.files)){if(entry.dir||!isMediaFile(entry.name)||/\.zip$/i.test(entry.name)||entry.name.startsWith('official_exports/'))continue;
  const sz=entry._data?.uncompressedSize??Infinity;if(sz>MAX_EXTRACT_FILE||extractedBytes+sz>MAX_EXTRACT_TOTAL){mediaSkip++;continue;}
  try{const blob=await entry.async('blob');if(blob.size>MAX_EXTRACT_FILE||extractedBytes+blob.size>MAX_EXTRACT_TOTAL){mediaSkip++;continue;}extractedBytes+=blob.size;const name=entry.name.split('/').pop()||entry.name;newFiles.push({id:`zip_${file.name}_${entry.name}`,name,originalPath:entry.name,category:(entry.name.match(/^attachments\/(工作|投資|生活|感情|未分類)\//)?.[1]||determineCategory(entry.name)),type:mediaKind(name),size:blob.size,blob,importedAt:Date.now(),source:`從 ${file.name} 擷取`});}
  catch(e){mediaSkip++;}
 }
 if(newFiles.length){try{await txWrite('attachments',newFiles);mediaNew+=newFiles.length;}catch(e){failures.push(`${file.name}：自動擷取部分媒體未能存入本機。`);}}
 }
 else if(/\.json$/i.test(file.name)){try{incoming=normalizeJson(JSON.parse(await file.text()));if(!incoming.length)failures.push(`${file.name}：找不到支援的聊天資料結構。`);}catch(e){failures.push(`${file.name}：JSON格式錯誤`);}}
 else{failures.push(`${file.name}：目前只支援 ZIP 或 JSON`);continue;}
 if(incoming.length){const saved=new Map(chats.map(c=>[c.id,c]));const uniq=new Map();for(const c of incoming){if(uniq.has(c.id)&&uniq.get(c.id).messages.length>c.messages.length)continue;uniq.set(c.id,c);}
 const toSave=[];for(const c of uniq.values()){const existing=saved.get(c.id);if(existing){if(existing.messages?.length>c.messages.length)continue;if(!ownBackup)c.category=existing.category;updated++;}else imported++;toSave.push(c);}
 if(toSave.length){await txWrite('chats',toSave);await reload();}
 }
 }
 await reload();let msg=`完成：新增 ${imported} 筆對話、更新 ${updated} 筆；新增 ${mediaNew} 個 ZIP 內附件、保存 ${savedSources} 份原始 ZIP。`;if(mediaSkip)msg+=` 另有 ${mediaSkip} 個媒體檔因大小限制略過。`;if(failures.length)msg+=`\n注意：${failures.slice(0,4).join('；')}${failures.length>4?'（尚有其他問題）':''}`;toast(msg,11000);
 }catch(e){console.error(e);toast('匯入中斷：'+e.message,8000);}finally{importButton.disabled=false;$('archiveInput').value='';}}
async function addMedia(files){if(!files.length)return;const data=[];for(const f of files){data.push({id:`manual_${f.name}_${f.size}_${f.lastModified}`,name:f.name,originalPath:f.name,category:determineCategory(f.name),type:mediaKind(f.name),size:f.size,blob:f,source:'使用者手動加入',importedAt:Date.now()});}
 try{await txWrite('attachments',data);await reload();toast(`已加入 ${data.length} 個原始檔案到本機。請記得另外備份到 Google Drive。`);}catch(e){toast(`附件未全部保存，可能是手機儲存空間不足：${e.message}`,6500);}}
function renderChats(){const q=$('searchInput').value.trim().toLowerCase();$('filters').replaceChildren(...CATEGORIES.map(c=>pill(c,activeFilter,()=>{activeFilter=c;renderChats();})));
 const results=chats.filter(c=>(activeFilter==='全部'||c.category===activeFilter)&&(!q||c.title.toLowerCase().includes(q)||c.messages.some(m=>m.text.toLowerCase().includes(q))));$('matchCount').textContent=`${results.length} 筆`;
 const list=$('conversationList');list.replaceChildren();if(!results.length){const div=document.createElement('div');div.className='empty';const strong=document.createElement('b');strong.textContent=chats.length?'沒有符合條件的聊天':'尚未匯入聊天';const p=document.createElement('p');p.textContent=chats.length?'換個關鍵字或選擇「全部」試試。':'先按「匯入聊天備份」，選擇 OpenAI 官方下載的 ZIP 或 conversations.json。';div.append(strong,p);list.appendChild(div);return;}
 for(const c of results.slice(0,350)){const el=document.createElement('div');el.className='list-item';const icon=document.createElement('div');icon.className='file-icon';icon.textContent='☰';const main=document.createElement('button');main.className='item-main';const title=document.createElement('strong');title.textContent=c.title;const desc=document.createElement('p');desc.textContent=`${fmtTime(c.updatedAt)} ・ ${c.messages.length} 則訊息 ・ ${c.source||'聊天紀錄'}`;main.append(title,desc);main.addEventListener('click',()=>openReader(c.id));const cat=document.createElement('span');cat.className='category-badge';cat.textContent=c.category;el.append(icon,main,cat);list.appendChild(el);}
 if(results.length>350){const note=document.createElement('p');note.className='small';note.textContent=`目前只顯示前 350 筆（共 ${results.length} 筆），請用搜尋縮小範圍。`;list.appendChild(note);}}
function renderMedia(){$('mediaFilters').replaceChildren(...CATEGORIES.map(c=>pill(c,mediaFilter,()=>{mediaFilter=c;renderMedia();})));const matches=attachments.filter(a=>mediaFilter==='全部'||a.category===mediaFilter);const list=$('mediaList');list.replaceChildren();if(!matches.length){const d=document.createElement('div');d.className='empty';d.textContent='沒有附件，按「加入檔案」儲存原始圖片、語音或文件。';list.appendChild(d);return;}
 for(const a of matches){const el=document.createElement('div');el.className='list-item';const icon=document.createElement('div');icon.className='file-icon';icon.textContent=iconFor(a.name);const main=document.createElement('button');main.className='item-main';const t=document.createElement('strong');t.textContent=a.name;const p=document.createElement('p');p.textContent=`${a.type} ・ ${fmtSize(a.size)} ・ ${a.source}`;main.append(t,p);main.addEventListener('click',()=>downloadBlob(a.blob,a.name));const cat=document.createElement('span');cat.className='category-badge';cat.textContent=a.category;const opt=document.createElement('button');opt.className='more';opt.title='更改分類';opt.textContent='⋯';opt.addEventListener('click',async()=>{const v=prompt(`更改「${a.name}」分類：工作 / 投資 / 生活 / 感情 / 未分類`,a.category);if(!v)return;if(!GROUPS.includes(v)){toast('分類必須是工作、投資、生活、感情、未分類');return;}a.category=v;await txWrite('attachments',[a]);await reload();});el.append(icon,main,cat,opt);list.appendChild(el);}}
function renderArchives(){const list=$('archiveList');list.replaceChildren();if(!archives.length){const d=document.createElement('div');d.className='empty';d.textContent='目前沒有在本機保存的官方 ZIP。請優先將原始 ZIP 直接上傳到 Google Drive。';list.appendChild(d);return;}
 for(const a of archives){const el=document.createElement('div');el.className='list-item';const icon=document.createElement('div');icon.className='file-icon';icon.textContent='▣';const main=document.createElement('button');main.className='item-main';const t=document.createElement('strong');t.textContent=a.name;const p=document.createElement('p');p.textContent=`${fmtSize(a.size)} ・ 匯入：${fmtTime(a.importedAt)}`;main.append(t,p);main.addEventListener('click',()=>downloadBlob(a.blob,a.name));el.append(icon,main);list.appendChild(el);}}
function readableRole(role){return({user:'你',assistant:'ChatGPT',system:'系統',tool:'工具',developer:'開發者'})[role]||role;}
function formattedConversation(c){return `${c.title}\n分類：${c.category}｜日期：${fmtTime(c.createdAt)}｜原始來源：${c.source}\n\n`+c.messages.map((m,i)=>`[${i+1}] ${readableRole(m.role)}${m.time?' · '+fmtTime(m.time):''}\n${m.text}`).join('\n\n------\n\n');}
function openReader(id){const c=chats.find(x=>x.id===id);if(!c)return;openedConversation=c;$('readerTitle').textContent=c.title;$('readerMeta').textContent=`${fmtTime(c.createdAt)} ・ ${c.messages.length} 則對話`;fillSelect($('readerCategory'),c.category);const container=$('readerMessages');container.replaceChildren();for(const m of c.messages){const box=document.createElement('div');box.className='message';box.dataset.role=m.role;const label=document.createElement('div');label.className='message-role';label.textContent=readableRole(m.role)+(m.time?' ・ '+fmtTime(m.time):'');const text=document.createElement('div');text.className='message-text';text.textContent=m.text;box.append(label,text);container.append(box);} $('readerDialog').showModal();}
function downloadBlob(blob,name){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function createBackup(){backupFile=null;readyBackup=null;$('backupCommands').classList.add('hidden');if(!chats.length&&!attachments.length&&!archives.length){toast('目前沒有可備份的資料');return;}const estimate=attachments.reduce((x,f)=>x+f.size,0)+archives.reduce((x,f)=>x+f.size,0);if(estimate>MAX_EXPORT_MEMORY){toast(`附件與原始 ZIP 合計 ${fmtSize(estimate)}，超過手機安全打包門檻。請分別把原始檔上傳 Google Drive，或在電腦執行。`,8500);return;}
 const btn=$('buildBackup');btn.disabled=true;btn.textContent='正在建立備份包…';try{const zip=new JSZip();const date=new Date().toISOString().slice(0,10);const manifest={app:'聊天備份助手',version:'1.1',createdAt:new Date().toISOString(),description:'離線整理備份；原始逐字與完整媒體應以官方 ZIP 為準',conversations:chats.length,attachments:attachments.length,sourceArchives:archives.length,limitations:['手機本機資料不保證永久保留','不會自動讀取 ChatGPT App 新聊天','聊天 JSON 僅有可解析文字，非 ChatGPT 原始全部資料','媒體僅包含匯入時實際取得的原檔']};zip.file('README_請先閱讀.txt',`聊天備份助手 ${date}\n這份備份包含此工具已匯入的聊天索引與附件。\n如有 official_exports/ 的 ZIP，原始官方資料請以該 ZIP 為準。\n沒有保證備份所有 ChatGPT 圖片、錄音、附件；沒有自動同步。\n請另外在 Google Drive 保留每次官方下載的原始 ZIP。\n`);
 zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('conversations_normalized.json',JSON.stringify(chats,null,2));
 for(const cat of GROUPS){const catRows=chats.filter(c=>c.category===cat);if(catRows.length){const lines=catRows.map(c=>formattedConversation(c)).join('\n\n=================\n\n');zip.file(`分類文字/${cat}.txt`,lines);}}
 for(const [i,a] of attachments.entries()){const folder=zip.folder('attachments').folder(a.category);zip.file(`${String(i+1).padStart(4,'0')}_${escapePath(a.name)}`,a.blob,{binary:true});}
 for(const [i,a] of archives.entries())zip.file(`official_exports/${String(i+1).padStart(3,'0')}_${escapePath(a.name)}`,a.blob,{binary:true,compression:'STORE'});
 readyBackup=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}},metadata=>{btn.textContent=`正在打包 ${Math.round(metadata.percent)}%`});const stamp=new Date().toISOString().replace(/[:.]/g,'-');backupFile=new File([readyBackup],`ChatGPT_備份助手_${stamp}.zip`,{type:'application/zip'});$('backupInfo').textContent=`備份包已產生：${fmtSize(backupFile.size)}。請使用「分享」或「下載」實際存到 Google Drive。`;$('backupCommands').classList.remove('hidden');toast('ZIP 已建立。可按一鍵上傳 Drive，或自行下載保存。');return backupFile;
 }catch(e){console.error(e);toast(`建立備份包失敗：${e.message}`,6000);return null;}finally{btn.disabled=false;btn.textContent='重新建立備份 ZIP';}}
async function shareBackup(){if(!backupFile){toast('請先建立備份 ZIP');return;}if(navigator.share&&navigator.canShare?.({files:[backupFile]})){try{await navigator.share({files:[backupFile],title:'ChatGPT 備份資料',text:'請保存到我的 Google Drive'});toast('已交給手機分享功能；請自行確認 Google Drive 是否上傳成功。');return;}catch(e){if(e.name==='AbortError')return;toast('手機分享失敗，請改用下載 ZIP。');return;}}toast('此瀏覽器不支援分享 ZIP 檔，請使用「下載 ZIP」，再上傳 Google Drive。');}

// Google Drive OAuth: 最小 drive.file 權限；Access Token 僅保留記憶體。
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME='ChatGPT_備份助手_一鍵上傳';
const DRIVE_CLIENT_ID_STORAGE='backup_assistant_google_client_id';
let googleToken=null, googleTokenExpiry=0, googleTokenClient=null, driveBusy=false;
const driveSetStatus=(message,kind='')=>{const el=$('driveStatus');el.textContent=message;el.className='drive-status '+kind;};
function getClientId(){return $('googleClientId').value.trim();}
function setDriveButtons(busy){driveBusy=busy;const b=$('driveOneClick');b.disabled=busy;b.textContent=busy?'處理中，請勿關閉頁面…':'☁ 一鍵備份到 Google Drive';}
function getDriveAccessToken(clientId){
  if(googleToken&&Date.now()<googleTokenExpiry-60000)return Promise.resolve(googleToken);
  if(!window.google?.accounts?.oauth2)throw Error('Google 登入元件未載入。請確認網路連線，使用 Safari 一般分頁重新整理。');
  // 重要：必須在使用者實際點擊事件中立即呼叫 requestAccessToken，以避免 Safari 阻擋彈窗。
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;error?reject(error):resolve(result);};
    googleTokenClient=google.accounts.oauth2.initTokenClient({
      client_id:clientId,scope:DRIVE_SCOPE,
      callback:(response)=>{
        if(response.error)return finish(Error('Google 授權未完成：'+response.error));
        if(!response.access_token)return finish(Error('Google 沒有回傳有效授權。'));
        googleToken=response.access_token;
        googleTokenExpiry=Date.now()+Math.max(0,Number(response.expires_in)||3500)*1000;
        finish(null,googleToken);
      },
      error_callback:(e)=>finish(Error(e?.type==='popup_closed'?'你關閉了 Google 授權視窗。':'無法開啟 Google 授權視窗，請在 Safari 一般分頁重試。'))
    });
    googleTokenClient.requestAccessToken({prompt:'consent'});
  });
}
async function driveRequest(url,options={},token=googleToken){
  const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
  let resp;
  try{resp=await fetch(url,{...options,headers});}catch(e){throw Error('無法連接 Google Drive。請檢查網路及瀏覽器的跨網站追蹤／授權限制。');}
  const json=await resp.json().catch(()=>({}));
  if(!resp.ok){let reason=json?.error?.message||`${resp.status} ${resp.statusText}`;
    if(resp.status===401){googleToken=null;googleTokenExpiry=0;reason='Google 授權過期，請再按一次上傳。';}
    if(resp.status===403)reason+='（請確認已啟用 Drive API、OAuth 測試使用者及授權範圍）';
    throw Error(reason);
  }
  return json;
}
function quoteDriveQuery(s){return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
async function driveEnsureFolder(token){
  const q=`name = '${quoteDriveQuery(DRIVE_FOLDER_NAME)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const list=await driveRequest(`https://www.googleapis.com/drive/v3/files?spaces=drive&pageSize=100&fields=files(id,name,mimeType),nextPageToken&q=${encodeURIComponent(q)}`,{},token);
  const folder=list.files?.find(f=>f.name===DRIVE_FOLDER_NAME);
  if(folder?.id)return folder.id;
  const created=await driveRequest('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:DRIVE_FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})},token);
  if(!created.id)throw Error('Drive 資料夾建立失敗。');
  return created.id;
}
async function driveUploadBackup(file,folderId,token){
  const boundary='chatbackup_'+Math.random().toString(36).slice(2);
  const metadata={name:file.name,mimeType:'application/zip',parents:[folderId],description:'由 ChatGPT 聊天備份助手 v1.1 經本人授權上傳'};
  const multipart=new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
    file,
    `\r\n--${boundary}--\r\n`
  ]);
  return driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,parents,webViewLink',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body:multipart},token);
}
async function oneClickDrive(){
  if(driveBusy)return;
  const clientId=getClientId();
  if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)){
    driveSetStatus('請先填入 Google Cloud 建立的「網頁應用程式 OAuth Client ID」，不是 API Key。','error');return;
  }
  if(!chats.length&&!attachments.length&&!archives.length){driveSetStatus('本機還沒有聊天或附件可備份。請先匯入檔案。','error');return;}
  localStorage.setItem(DRIVE_CLIENT_ID_STORAGE,clientId);
  $('driveResult').classList.add('hidden');
  setDriveButtons(true);driveSetStatus('正在請求 Google 授權…');
  try{
    // 先授權、後打包，保持 Safari OAuth 彈窗在點擊事件的使用者手勢內。
    const token=await getDriveAccessToken(clientId);
    driveSetStatus('正在建立最新備份 ZIP…');
    const file=await createBackup();
    if(!file)throw Error('ZIP 沒有成功建立；資料過大時可分開上傳，或使用電腦。');
    driveSetStatus(`正在準備 Google Drive 資料夾，將上傳 ${fmtSize(file.size)}…`);
    const folderId=await driveEnsureFolder(token);
    driveSetStatus(`正在上傳 ${fmtSize(file.size)} 到 Google Drive…`);
    const uploaded=await driveUploadBackup(file,folderId,token);
    // 讀回 metadata 而非只信任 POST 成功；至少核對檔名、大小及父資料夾。
    const verified=await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}?fields=id,name,size,parents,webViewLink`,{},token);
    if(verified.name!==file.name||Number(verified.size)!==file.size||!verified.parents?.includes(folderId))throw Error('檔案已送出，但雲端檔名、大小或儲存位置核對異常。請自行進入 Drive 檢查。');
    const link=verified.webViewLink||`https://drive.google.com/file/d/${encodeURIComponent(verified.id)}/view`;
    $('driveFileLink').href=link;$('driveFolderLink').href=`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
    $('driveResult').classList.remove('hidden');
    driveSetStatus(`上傳成功！已核對：${file.name}（${fmtSize(file.size)}），儲存在 Google Drive 專屬備份資料夾。`,'success');
    toast('Google Drive 已完成上傳並驗證檔案大小！',6000);
  }catch(e){console.error(e);driveSetStatus(`備份尚未確認成功：${e.message}`,'error');toast('Google Drive 一鍵備份未完成；本機資料未刪除。',6000);}finally{setDriveButtons(false);}
}

function selectTab(name){activeTab=name;for(const btn of document.querySelectorAll('[data-tab]')){btn.classList.toggle('active',btn.dataset.tab===name);if(btn.dataset.tab===name)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');}for(const v of ['chats','media','backup','guide'])$(`view-${v}`).classList.toggle('hidden',v!==name);}
function installEvents(){document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));$('openImport').addEventListener('click',()=>$('archiveInput').click());$('openMedia').addEventListener('click',()=>$('mediaInput').click());$('mediaAddMore').addEventListener('click',()=>$('mediaInput').click());$('archiveInput').addEventListener('change',e=>importFiles([...e.target.files]));$('mediaInput').addEventListener('change',e=>addMedia([...e.target.files]).finally(()=>{$('mediaInput').value='';}));$('searchInput').addEventListener('input',renderChats);$('closeReader').addEventListener('click',()=>$('readerDialog').close());$('closeNote').addEventListener('click',()=>$('noteDialog').close());$('readerCategory').addEventListener('change',async e=>{if(!openedConversation)return;openedConversation.category=e.target.value;await txWrite('chats',[openedConversation]);await reload();toast('分類已更新');});$('copyConversation').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(formattedConversation(openedConversation));toast('聊天內容已複製');}catch(e){toast('複製失敗，可使用「匯出文字檔」');}});$('exportConversation').addEventListener('click',()=>{if(!openedConversation)return;downloadBlob(new Blob([formattedConversation(openedConversation)],{type:'text/plain;charset=utf-8'}),`${escapePath(openedConversation.title)}.txt`);});$('newNote').addEventListener('click',()=>{fillSelect($('noteCategory'),'未分類');$('noteDialog').showModal();});$('noteForm').addEventListener('submit',async e=>{e.preventDefault();const now=Date.now();const entry={id:`manual_${now}_${Math.random().toString(36).slice(2)}`,title:$('noteTitle').value.trim(),category:$('noteCategory').value,createdAt:now,updatedAt:now,messages:[{role:'user',text:$('noteBody').value,time:now,id:null}],source:'手動加入的文字',importedAt:now};if(!entry.title||!entry.messages[0].text.trim())return;await txWrite('chats',[entry]);$('noteForm').reset();$('noteDialog').close();await reload();toast('手動紀錄已保存到本機。');});$('buildBackup').addEventListener('click',createBackup);$('driveOneClick').addEventListener('click',oneClickDrive);$('shareBackup').addEventListener('click',shareBackup);$('downloadBackup').addEventListener('click',()=>{if(backupFile)downloadBlob(backupFile,backupFile.name);});$('clearAll').addEventListener('click',async()=>{if(!confirm('確定刪除本工具在這台裝置上的全部聊天、圖片、錄音與原始 ZIP 嗎？\n\n這不會刪除 ChatGPT 或 Google Drive 中的原始資料。'))return;if(!confirm('最後確認：本機資料刪除後無法復原。請確定你已把 ZIP 備份到 Google Drive。'))return;for(const store of ['chats','attachments','archives'])await new Promise((resolve,reject)=>{const tx=database.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});await reload();toast('本機資料已清除。');});$('readerDialog').addEventListener('click',e=>{if(e.target===$('readerDialog'))$('readerDialog').close();});$('noteDialog').addEventListener('click',e=>{if(e.target===$('noteDialog'))$('noteDialog').close();});}
(async function init(){const saved=localStorage.getItem(DRIVE_CLIENT_ID_STORAGE);if(saved)$('googleClientId').value=saved;installEvents();try{database=await openDB();await reload();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(e){console.error(e);toast(`本機資料庫無法啟用：${e.message}。請改以 Safari/Chrome 的一般瀏覽模式使用。`,9000);}})();
