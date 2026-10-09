import {emptyDocument,blankDocument,validateDocument,resolve,movePoint,removePoint,removeSelection} from './math.js';
import {generateTable,tableExpressions} from './table.js';
import {exprToLatex,compileExpressionP,detectExpressionType,normalizeToLHS} from './expression.js';
import {renderSVG,graphSVG,chartSVG,solidSVG,solidNames,escape,exportSVG} from './render.js';
import {templateLibrary,applyLibraryTemplate} from './library.js';
import {requestProposal} from './ai.js';
import {buildCodexPrompt,parseCodexDraft} from './codex-bridge.js';
const $=id=>document.getElementById(id);
if(window.parent!==window)document.body.classList.add('embedded');
const testing=new URLSearchParams(location.search).get('testing')==='1';
function sizeViewport(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');}
window.addEventListener('resize',sizeViewport,{passive:true});sizeViewport();
let doc=blankDocument(),mode='geometry',tool='select',selected='',pending=[],snappedPointId=null,scale=55,history=[],future=[],drag=null,image=null,proposal=null,revision=0,busy=false,pan={x:0,y:0};
const tools=[
 ['select','↖','Chọn / kéo',0,'Chọn đối tượng hoặc kéo điểm tự do'],['region','▧','Chọn vùng',0,'Kéo chuột trái tạo khung; hình hữu hạn nằm trọn, đường/tia cắt khung. Esc bỏ chọn'],['point','•','Điểm',0,'Nhấn vào bảng để tạo điểm'],
 ['segment','╱','Đoạn',2,'Chọn hai đầu đoạn'],['line','⟋','Đường',2,'Chọn hai điểm trên đường'],['polygon','⬠','Đa giác',-1,'Chọn ≥3 điểm, chọn lại điểm đầu để đóng'],['circle','○','Đường tròn',2,'Chọn tâm rồi điểm trên đường tròn'],
 ['midpoint','⊙','Trung điểm',2,'Chọn hai đầu đoạn'],['foot','⊥','Đường cao',3,'Chọn đỉnh, rồi hai điểm của đường đáy'],['parallel','∥','Song song',3,'Chọn điểm đi qua, rồi hai điểm của đường gốc'],['perpendicular','∟','Vuông góc',3,'Chọn điểm đi qua, rồi hai điểm của đường gốc'],['bisector','∠','Phân giác',3,'Chọn điểm trên cạnh, đỉnh góc, điểm trên cạnh còn lại'],['intersection','×','Giao 2 đường',4,'Chọn A,B của đường 1 rồi C,D của đường 2'],['lineCircle','⊗','Giao đường/tròn',4,'Chọn hai điểm đường, tâm tròn, điểm bán kính'],['circleCircle','◉','Giao 2 tròn',4,'Chọn tâm và điểm bán kính của từng đường tròn'],['onLine','↔','Thuộc đường',2,'Chọn hai điểm của đường chứa điểm mới'],['onCircle','◌','Thuộc tròn',2,'Chọn tâm và điểm bán kính'],['equal','＝','Bằng độ dài',3,'Chọn điểm gốc, rồi hai điểm đoạn tham chiếu; sửa góc trong thuộc tính'],['tangent','⌁','Tiếp tuyến',3,'Chọn điểm ngoài, tâm tròn, điểm bán kính'],['vector','→','Vectơ',2,'Chọn điểm đầu, điểm cuối'],['vectorSum','⇉','Cộng vectơ',4,'Chọn đầu/cuối vectơ 1 rồi đầu/cuối vectơ 2'],['angle','∠','Đo góc',3,'Chọn cạnh, đỉnh, cạnh'],['length','↦','Độ dài',2,'Chọn hai đầu đoạn']
];
tools.push(['ray','↗','Tia',2,'Chọn gốc tia, rồi điểm xác định hướng'],['perpendicularBisector','⟂','Trung trực',2,'Chọn hai đầu đoạn; trung trực đi qua trung điểm']);
const names=Object.fromEntries(tools.map(t=>[t[0],t[2]]));
tools.push(['pan','✥','Di chuyển',0,'Kéo nền để di chuyển khung. Đặt lại bằng nút %']);
tools.push(['vectorDifference','⇠','Hiệu vectơ',4,'Chọn đầu/cuối vectơ 1 rồi đầu/cuối vectơ 2'],['vectorScale','k→','Nhân vectơ',3,'Chọn gốc đặt kết quả, rồi đầu/cuối vectơ nguồn; sửa hệ số k'],['dot','·','Tích vô hướng',4,'Chọn đầu/cuối từng vectơ'],['vectorAngle','∠→','Góc hai vectơ',4,'Chọn đầu/cuối từng vectơ'],['vectorCoords','(x;y)','Tọa độ vectơ',2,'Chọn điểm đầu và cuối'],['circumcenter','⊙','Tâm ngoại tiếp',3,'Chọn ba đỉnh tam giác'],['incenter','◉','Tâm nội tiếp',3,'Chọn ba đỉnh tam giác'],['reflectAxis','↹','Đối xứng trục',3,'Chọn điểm gốc, rồi hai điểm đường trục'],['reflectCenter','⤡','Đối xứng tâm',2,'Chọn điểm gốc, rồi điểm tâm'],['translate','↦','Tịnh tiến',1,'Chọn điểm gốc; sửa vector dịch chuyển trong thuộc tính'],['rotateAround','⟳','Quay',2,'Chọn điểm gốc, rồi tâm quay; sửa góc trong thuộc tính'],['scaleFrom','⤢','Vị tự',2,'Chọn điểm gốc, rồi tâm vị tự; sửa hệ số k trong thuộc tính']);
Object.assign(names,Object.fromEntries(tools.map(t=>[t[0],t[2]])),{affine:'Dựng theo cạnh gốc',rotate:'Quay quanh tâm',reflectAxis:'Đối xứng trục',reflectCenter:'Đối xứng tâm',translate:'Tịnh tiến',rotateAround:'Quay',scaleFrom:'Vị tự'});
const selectedIds=new Set();
let keyboardOpen=false,keyboardInput=null,keyboardRange={id:'',start:0,end:0};
let selectedFace=null,solidFaceMode=false;
let draftBefore=null,sidebarView='tools';
function cancelConstruction(){if(draftBefore){doc=draftBefore;draftBefore=null;}pending=[];snappedPointId=null;}
function finishConstruction(next){const oldErrors=new Set(resolve(draftBefore||doc).errors),errors=resolve(next).errors.filter(e=>!oldErrors.has(e));if(errors.length){cancelConstruction();selected='';render();notify('Không dựng được '+names[tool]+': '+errors[0]+'. Chọn lại các điểm đúng điều kiện; Esc để hủy.');return;}if(draftBefore)doc=draftBefore;draftBefore=null;pending=[];if(commit(next))notify('Đã dựng '+names[tool]+'. Kéo điểm nguồn để kiểm tra; có thể hoàn tác.');else render();}
const mobile=()=>matchMedia('(max-width:700px)').matches;
function setSidebar(open){document.body.classList.toggle('sidebar-closed',!open);$('toggle-sidebar').setAttribute('aria-expanded',String(open));$('sidebar-backdrop').hidden=!open||!mobile();}
function closeMobileSidebar(){if(mobile())setSidebar(false);}
function syncSidebarTabs(){for(const [id,view]of [['show-tools','tools'],['show-properties','properties']]){$(id).classList.toggle('active',sidebarView===view);$(id).setAttribute('aria-pressed',String(sidebarView===view));}}
$('toggle-sidebar').onclick=()=>setSidebar(document.body.classList.contains('sidebar-closed'));
$('sidebar-backdrop').onclick=()=>setSidebar(false);
document.querySelector('.details').id='details-panel';
for(const [id,view]of [['show-tools','tools'],['show-properties','properties']])$(id).onclick=()=>{cancelConstruction();sidebarView=view;syncSidebarTabs();render();};
const mobileBreakpoint=matchMedia('(max-width:700px)');mobileBreakpoint.addEventListener('change',()=>setSidebar(!mobile()));setSidebar(!mobile());
const zoom=document.querySelector('.zoom-controls');for(const id of ['zoom-in','reset-view','zoom-out'])zoom.append($(id));document.querySelector('.divider').remove();
function notify(message){$('notice').textContent=message;}
function persist(){$('save-state').textContent=testing?'Kiểm thử · không ghi bản người dùng':'Trong phiên · Lưu JSON để giữ';}
function commit(next,{keepSelection=false}={}){try{next=validateDocument(next);}catch(e){notify(e.message);return false;}if(draftBefore)doc=draftBefore;draftBefore=null;pending=[];snappedPointId=null;if(!keepSelection)selectedIds.clear();if(JSON.stringify(next)===JSON.stringify(doc)){render();return true;}history.push(structuredClone(doc));if(history.length>80)history.shift();future=[];doc=next;revision++;persist();render();if(!testing)window.parent.word2latexDrawingLog?.('Vẽ hình: chỉnh sửa');return true;}
function freshId(source=doc){for(let i=0;i<26;i++){const id=String.fromCharCode(65+i);if(![...source.points,...source.shapes].some(p=>p.id===id))return id;}let i=1;while([...source.points,...source.shapes].some(p=>p.id==='P'+i))i++;return'P'+i;}
function addShape(next,type,refs,extra={}){let i=1;while(next.shapes.some(s=>s.id==='s'+i)||next.points.some(p=>p.id==='s'+i))i++;next.shapes.push({id:'s'+i,type,refs:[...refs],color:'#176b52',...extra});selected='s'+i;}
function pickTool(value){cancelConstruction();selectedIds.clear();selected='';notify('');tool=value;closeMobileSidebar();render();}
const toolGroups=[['Cơ bản',['select','region','point','segment','line','ray','polygon','circle','pan']],['Dựng quan hệ',['midpoint','perpendicularBisector','foot','parallel','perpendicular','bisector','equal','onLine','onCircle','circumcenter','incenter','tangent']],['Giao điểm',['intersection','lineCircle','circleCircle']],['Đo lường & vectơ',['length','angle','vector','vectorSum','vectorDifference','vectorScale','dot','vectorAngle','vectorCoords']],['Biến hình',['reflectAxis','reflectCenter','translate','rotateAround','scaleFrom']]];
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
function toolMarkup(){const query=normalize($('tool-search').value);let count=0;const markup=toolGroups.map(([label,ids],index)=>{const items=ids.map(id=>tools.find(t=>t[0]===id)).filter(t=>normalize(t[2]+' '+t[4]).includes(query));count+=items.length;return items.length?'<details class="tool-section" '+(query||index===0?'open':'')+'><summary>'+label+'</summary><div class="tool-grid">'+items.map(t=>`<button data-tool="${t[0]}" title="${t[4]}" class="${tool===t[0]?'active':''}" aria-pressed="${tool===t[0]}"><span class="icon" aria-hidden="true">${t[1]}</span>${t[2]}</button>`).join('')+'</div></details>':'';}).join('');$('no-tools').hidden=count>0;return markup;}
$('tool-search').oninput=()=>$('toolbar').innerHTML=toolMarkup();
$('toolbar').innerHTML=toolMarkup();$('toolbar').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)pickTool(b.dataset.tool);});
function currentSVG(d = doc){const opts={grid:mode!=='geometry'&&$('grid').checked,scale,selected,pending,selectedIds};const svg=mode==='geometry'?renderSVG(d,opts):mode==='graph'?graphSVG(d.graph,opts):mode==='chart'?chartSVG(d.chart,opts):solidSVG(d.solid,{selectedFace});return mode==='geometry'?svg.replace('<rect width="1000" height="660" fill="#ffffff"/>','').replace('viewBox="0 0 1000 660"',`viewBox="${pan.x} ${pan.y} 1000 660"`):svg;}
const mathKeys=[['x','x','x'],['y','y','y'],['pi','π','pi'],['e','e','e'],['open','(','('],['close',')',')'],...Array.from({length:10},(_,i)=>[String(i),String(i),String(i)]),['decimal','.', '.'],['add','+','+'],['subtract','−','-'],['multiply','×','*'],['divide','÷','/'],['power','xⁿ','^'],['square','x²','^2'],['sqrt','√','sqrt()',5],['sin','sin','sin()',4],['cos','cos','cos()',4],['tan','tan','tan()',4],['ln','ln','ln()',3],['log','log₁₀','log()',4],['exp','eˣ','exp()',4],['abs','|x|','abs()',4],['equal','=','='],['less','<','<'],['greater','>','>'],['lessEqual','≤','<='],['greaterEqual','≥','>='],['left','←'],['right','→'],['backspace','⌫'],['delete','⌦']];
function mathKeyboardMarkup(){return '<details id="math-keyboard" class="math-keyboard" '+(keyboardOpen?'open':'')+'><summary>⌨ Bàn phím toán học</summary><p id="keyboard-target" class="tiny">Chọn ô hàm để nhập; y dùng trong phương trình ẩn.</p><div class="math-key-grid" role="group" aria-label="Phím toán học">'+mathKeys.map(([id,label,code])=>'<button type="button" data-math-key="'+id+'" aria-label="'+({sqrt:'Căn bậc hai',backspace:'Xóa ký tự trước con trỏ',delete:'Xóa ký tự sau con trỏ',left:'Dịch con trỏ trái',right:'Dịch con trỏ phải'}[id]||escape(label))+'" title="'+escape(code||label)+'">'+escape(label)+'</button>').join('')+'</div><p class="tiny">Chèn vào con trỏ hoặc thay phần đang chọn. Bấm Cập nhật đồ thị để áp dụng.</p></details>';}
function bindMathKeyboard(target){
 const remember=input=>{keyboardInput=input;keyboardRange={id:input.dataset.id,start:input.selectionStart??0,end:input.selectionEnd??0};$('keyboard-target').textContent='Đang nhập Hàm '+([...target.querySelectorAll('.expr-val')].indexOf(input)+1)+' · chưa áp dụng';};
 for(const input of target.querySelectorAll('.expr-val'))for(const event of ['focus','input','keyup','pointerup','select','blur'])input.addEventListener(event,()=>remember(input));
 $('math-keyboard').ontoggle=e=>keyboardOpen=e.target.open;
 for(const button of target.querySelectorAll('[data-math-key]')){button.onpointerdown=e=>e.preventDefault();button.onclick=()=>{
 const inputs=[...target.querySelectorAll('.expr-val')],input=inputs.find(el=>el.dataset.id===keyboardRange.id)||inputs[0];if(!input)return notify('Bấm Thêm hàm để có ô công thức trước.');
 const remembered=input!==keyboardInput&&input.dataset.id===keyboardRange.id?{...keyboardRange}:null;input.focus({preventScroll:true});if(remembered)input.setSelectionRange(Math.min(input.value.length,remembered.start),Math.min(input.value.length,remembered.end));
 const [id,,code,offset]=mathKeys.find(key=>key[0]===button.dataset.mathKey);let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
 if(id==='left'||id==='right'){const cursor=id==='left'?(start!==end?start:Math.max(0,start-1)):(start!==end?end:Math.min(input.value.length,end+1));input.setSelectionRange(cursor,cursor);}
 else{if(id==='backspace'&&start===end)start=Math.max(0,start-1);if(id==='delete'&&start===end)end=Math.min(input.value.length,end+1);const text=code||'';input.setRangeText(text,start,end,'end');if(offset!==undefined)input.setSelectionRange(start+offset,start+offset);input.dispatchEvent(new Event('input',{bubbles:true}));}remember(input);
 };}
}
function graphFeedback(graph){const params=Object.fromEntries(graph.params.map(p=>[p.name,p.value])),messages=[];
 for(const [i,e]of graph.expressions.entries()){if(e.visible===false)continue;const prefix='Hàm '+(i+1)+': ';try{const expression=normalizeToLHS(e.expr).lhs,type=detectExpressionType(e.expr),names=expression.replace(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g,'').match(/[A-Za-z]+/g)||[],missing=[...new Set(names.filter(n=>/^[a-z]$/.test(n)&&n!=='x'&&n!=='e'&&!(n==='y'&&type!=='explicit')&&!Object.hasOwn(params,n)))];
 if(missing.length){messages.push(prefix+'thiếu tham số '+missing.join(', ')+'. Bấm Thêm tham số hoặc sửa tên trong biểu thức.');continue;}
 const fn=compileExpressionP(expression);if(type==='explicit'){const values=Array.from({length:121},(_,j)=>fn((j/120-.5)*1000/scale,params)).filter(Number.isFinite);if(!values.length)messages.push(prefix+'chưa lấy được giá trị hữu hạn trong khoảng x đang xem. Kiểm tra miền xác định, tham số hoặc thu nhỏ để tìm miền khác.');else if(!values.some(y=>Math.abs(y*scale)<=330))messages.push(prefix+'các giá trị y đang nằm ngoài khung. Thử thu nhỏ hoặc điều chỉnh biểu thức/tham số.');}
 }catch(err){messages.push(prefix+err.message+'. Sửa biểu thức rồi cập nhật.');}}
 return messages;
}
function renderCanvas(d = doc, snapId = null){try{let svgStr=currentSVG(d);if(snapId&&mode==='geometry'){const snapPoint=resolve(d).points[snapId];if(snapPoint){const cx=500+snapPoint.x*scale;const cy=330-snapPoint.y*scale;svgStr=svgStr.replace('</svg>',`<circle cx="${cx}" cy="${cy}" r="15" fill="rgba(255, 204, 0, 0.4)" stroke="#ffcc00" stroke-width="2" pointer-events="none"/></svg>`);}}$('canvas').innerHTML=svgStr;updateCanvasGrid();for(const el of [...$('canvas').querySelectorAll('[data-shape]')]){if(!doc.shapes.some(shape=>shape.id===el.dataset.shape)){el.removeAttribute('data-shape');el.setAttribute('pointer-events','none');continue;}if(el.tagName.toLowerCase()==='text')continue;const hit=el.cloneNode(true);hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','20');hit.setAttribute('fill','none');hit.style.fill='none';hit.setAttribute('pointer-events','stroke');hit.removeAttribute('marker-end');el.before(hit);}}catch(e){notify(e.message);}$('errors').textContent=mode==='geometry'?resolve(doc).errors.map(e=>e+' · Kéo điểm nguồn về vị trí hợp lệ hoặc hoàn tác.').join('\n'):mode==='graph'?graphFeedback(doc.graph).join('\n'):'';}
function render(){const ids=new Set([...doc.points,...doc.shapes].map(o=>o.id));for(const id of selectedIds)if(!ids.has(id))selectedIds.delete(id);if(mode==='geometry'&&!doc.points.some(p=>p.id===selected)&&!doc.shapes.some(s=>s.id===selected))selected='';renderCanvas(doc);if($('delete-selected'))$('delete-selected').disabled=mode==='geometry'&&!selected&&!selectedIds.size;$('title').value=doc.title;$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('reset-view').textContent=Math.round(scale/55*100)+'%';document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode);});document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',b.dataset.tool===tool);});$('toolbar').closest('.tools').hidden=mode!=='geometry'||sidebarView==='properties';$('details-panel').hidden=mode==='geometry'&&sidebarView==='tools';$('show-tools').disabled=mode!=='geometry';const guide=tools.find(t=>t[0]===tool);$('hint').textContent=mode==='geometry'?guide[4]+(guide[3]!==0?' · Bước '+(pending.length+1)+(guide[3]>0?'/'+guide[3]:' · đóng tại điểm đầu'):'')+(pending.length?' · Đã chọn '+pending.join(' → '):''):'';
  if(mode!=='geometry')$('hint').textContent=mode==='graph'?'Sửa hàm và kéo thanh tham số a':mode==='chart'?'Sửa dữ liệu để cập nhật biểu đồ':'Kéo trên hình hoặc chỉnh thanh xoay';
  document.querySelector('#open-templates small').textContent=templateLibrary[mode].length+' mẫu · '+modeNames[mode];renderProperties();renderRestoreControl();}
const field=(label,html)=>`<label class="field">${label}${html}</label>`;
const number=(id,value,attrs='')=>`<input id="${id}" type="number" value="${value}" ${/\bstep=/.test(attrs)?'':'step="0.1"'} ${attrs}>`;
function renderProperties(){const target=$('properties');if(mode==='geometry'&&selectedIds.size){$('properties-title').textContent='Tập chọn';renderGroupProperties(target);return;}$('properties-title').textContent=mode==='geometry'?'Thuộc tính':mode==='graph'?'Hàm số & tham số':mode==='chart'?'Dữ liệu thống kê':'Góc nhìn không gian';
  if(mode==='geometry'){const p=doc.points.find(p=>p.id===selected),s=doc.shapes.find(s=>s.id===selected),coords=resolve(doc).points[selected];let html='<select class="object-list" id="object-select" aria-label="Chọn đối tượng"><option value="">Chọn một đối tượng…</option>'+doc.points.map(p=>`<option value="${escape(p.id)}" ${p.id===selected?'selected':''}>Điểm ${escape(p.label||p.id)}${p.kind?' · '+names[p.kind]:''}</option>`).join('')+doc.shapes.map(s=>`<option value="${escape(s.id)}" ${s.id===selected?'selected':''}>${names[s.type]} ${s.refs.join('')}</option>`).join('')+'</select>';
    if(p){html+=`<div class="point-card" style="margin-top:14px"><strong>Điểm ${escape(p.label||p.id)}</strong><small>${p.kind?escape(names[p.kind]+' · '+p.refs.join(', ')):'Điểm tự do · có thể kéo'}</small></div>`+field('Nhãn',`<input id="point-label" maxlength="80" value="${escape(p.label||p.id)}">`);const editable=!p.kind||['onLine','onCircle'].includes(p.kind);html+='<div class="coordinates">'+field('x',number('point-x',coords?.x.toFixed(3)??0,editable?'':'disabled'))+field('y',number('point-y',coords?.y.toFixed(3)??0,editable?'':'disabled'))+'</div>';if(editable)html+='<button id="apply-coordinates" class="secondary full">Áp dụng tọa độ</button>';if(['equal','onCircle','rotate','rotateAround'].includes(p.kind))html+=field('Góc hướng (độ)',number('point-angle',(p.angle??0)*180/Math.PI));if(['vectorScale','scaleFrom'].includes(p.kind))html+=field('Hệ số k',number('point-factor',p.factor??1));if(p.kind==='translate'){html+=field('Dịch x (dx)',number('point-dx',p.dx??0))+field('Dịch y (dy)',number('point-dy',p.dy??0));}if(p.kind==='affine')html+=field('Hệ số dọc AB (u)',number('point-u',p.u??0))+field('Hệ số vuông AB (v)',number('point-v',p.v??1));if(p.kind==='onLine')html+=field('Tham số t (A + t·AB)',number('point-t',p.t??.5));if(['lineCircle','circleCircle','tangent'].includes(p.kind))html+=field('Nhánh giao / tiếp tuyến',`<select id="point-branch"><option value="1" ${p.branch!==-1?'selected':''}>Nhánh +</option><option value="-1" ${p.branch===-1?'selected':''}>Nhánh −</option></select>`);if(p.kind&&!editable)html+='<p class="tiny">Điểm được tính từ nguồn; chọn điểm nguồn để thay vị trí.</p>';}
    else if(s){html+=`<div class="point-card" style="margin-top:14px"><strong>${names[s.type]} ${s.refs.join(', ')}</strong></div>`+field('Màu nét',`<input type="color" id="shape-color" value="${s.color||'#176b52'}">`)+`<label class="check"><input type="checkbox" id="shape-visible" ${s.visible!==false?'checked':''}>Hiển thị</label><label class="check"><input type="checkbox" id="shape-dashed" ${s.dashed?'checked':''}>Nét đứt</label>`+field('Ký hiệu (đánh dấu thủ công)',`<select id="shape-mark">${[['none','Không'],['tick','Một gạch'],['double','Hai gạch'],['parallel','Song song'],['right','Góc vuông']].map(([v,n])=>`<option value="${v}" ${(s.mark||'none')===v?'selected':''}>${n}</option>`).join('')}</select>`);html+='<p class="tiny">Ký hiệu chỉ là chú thích. Dùng công cụ quan hệ để tạo ràng buộc thật.</p>';}
    else html+='<p class="empty-properties">Chọn điểm hoặc đường trên bảng vẽ để xem tọa độ, đổi nhãn và kiểu nét.</p>';
    if(p||s)html+='<button id="delete-object" class="secondary full delete">Xóa đối tượng…</button>';target.innerHTML=html;
    $('object-select').onchange=e=>{selected=e.target.value;render();};
    if(p){$('point-label').onchange=e=>{const next=structuredClone(doc);next.points.find(q=>q.id===p.id).label=e.target.value;commit(next);};const applyCoordinates=()=>{const x=Number($('point-x').value),y=Number($('point-y').value);if($('point-x').value===''||$('point-y').value==='')return notify('Cần nhập đủ tọa độ');commit(movePoint(doc,p.id,x,y));};for(const axis of ['x','y'])$('point-'+axis).onkeydown=e=>{if(e.key==='Enter')applyCoordinates();};if($('apply-coordinates'))$('apply-coordinates').onclick=applyCoordinates;if($('point-visible'))$('point-visible').onchange=e=>{const next=structuredClone(doc);next.points.find(q=>q.id===p.id).visible=e.target.checked;commit(next);};for(const[k,id,factor]of [['angle','point-angle',Math.PI/180],['t','point-t',1],['branch','point-branch',1],['factor','point-factor',1],['u','point-u',1],['v','point-v',1],['dx','point-dx',1],['dy','point-dy',1]])if($(id))$(id).onchange=e=>{const next=structuredClone(doc);next.points.find(q=>q.id===p.id)[k]=Number(e.target.value)*factor;commit(next);};}
    if(s){$('shape-color').onchange=e=>editShape('color',e.target.value);$('shape-visible').onchange=e=>editShape('visible',e.target.checked);if($('shape-fill'))$('shape-fill').onchange=e=>editShape('fill',e.target.value||null);$('shape-dashed').onchange=e=>editShape('dashed',e.target.checked);$('shape-mark').onchange=e=>editShape('mark',e.target.value);}
    if($('delete-object'))$('delete-object').onclick=deleteSelection;
  }else if(mode==='graph'){
      const exps = doc.graph.expressions.map((e, i) => `
        <div class="expression-row" data-id="${escape(e.id)}" style="margin-bottom:10px; padding:8px; border:1px solid #cddcd5; border-radius:4px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:13px; font-weight:bold; align-items:center;">
            Hàm ${i+1}
            <div style="display:flex; align-items:center; gap:5px;">
              <input type="color" class="expr-color" data-id="${escape(e.id)}" value="${escape(e.color||'#176b52')}" style="width:24px;height:24px;padding:0;border:none;cursor:pointer;">
              <label style="margin:0;cursor:pointer;"><input type="checkbox" class="expr-vis" data-id="${escape(e.id)}" ${e.visible!==false?'checked':''}> Hiện</label>
              <button class="secondary tiny expr-del" data-id="${escape(e.id)}" style="padding:2px 6px">Xóa</button>
            </div>
          </div>
          <input type="text" class="expr-val full" data-id="${escape(e.id)}" value="${escape(e.expr)}" spellcheck="false" placeholder="Nhập hàm, VD: a*x^2 + b">
            <div class="expr-preview" data-id="${escape(e.id)}"></div>
        </div>
      `).join('');
      
      const prms = doc.graph.params.map(p => `
        <div class="param-row" style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
            <span>${escape(p.name)} = ${p.value}</span>
            <button class="secondary tiny param-del" data-name="${escape(p.name)}" style="padding:2px 6px">Xóa</button>
          </div>
          <input type="range" class="param-slider full" data-name="${escape(p.name)}" min="${p.min}" max="${p.max}" step="0.1" value="${p.value}">
        </div>
      `).join('');

      target.innerHTML = `
        <div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0">Danh sách hàm số</h4>
          <button id="open-table" class="secondary tiny" style="margin-right:5px;">Bảng giá trị</button><button id="add-expr" class="secondary tiny">+ Thêm hàm</button>
        </div>
        <div id="expressions-list">${exps}</div>${mathKeyboardMarkup()}
        <div style="margin-top:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0">Tham số</h4>
          <button id="add-param" class="secondary tiny">+ Thêm tham số</button>
        </div>
        <div id="params-list">${prms}</div>
        <button id="apply-graph" class="primary full" style="margin-top:10px;">Cập nhật đồ thị</button>
        <p class="tiny">Dùng * để nhân, ^ lũy thừa. Hàm: sin, cos, tan, sqrt... Hỗ trợ = (ẩn), <, >, <=, >= (bất PT).</p>
      `;

      bindMathKeyboard(target);
      const getInputs = () => {
        const next = structuredClone(doc);
        next.graph.enabled = true;
        [...target.querySelectorAll('.expr-val')].forEach(inp => {
          const ex = next.graph.expressions.find(e => e.id === inp.dataset.id);
          if (ex) ex.expr = inp.value;
        });
        return next;
      };

      document.getElementById('apply-graph').onclick = () => {notify('');try{const next=getInputs();next.graph.expressions.forEach((e,i)=>{try{compileExpressionP(normalizeToLHS(e.expr).lhs);}catch(err){throw Error('Hàm '+(i+1)+': '+err.message+'. Sửa biểu thức rồi cập nhật lại.');}});commit(next);}catch(err){notify(err.message);}};
      
      [...target.querySelectorAll('.expr-val')].forEach(el => {
        el.onkeydown = e => { if(e.key === 'Enter') document.getElementById('apply-graph').click(); };
      });
      [...target.querySelectorAll('.expr-color')].forEach(el => {
        el.onchange = e => {
          const next = getInputs();
          const ex = next.graph.expressions.find(x => x.id === el.dataset.id);
          if (ex) { ex.color = e.target.value; commit(next); }
        };
      });
      [...target.querySelectorAll('.expr-vis')].forEach(el => {
        el.onchange = e => {
          const next = getInputs();
          const ex = next.graph.expressions.find(x => x.id === el.dataset.id);
          if (ex) { ex.visible = e.target.checked; commit(next); }
        };
      });
      [...target.querySelectorAll('.expr-del')].forEach(el => {
        el.onclick = e => {
          const next = getInputs();
          next.graph.expressions = next.graph.expressions.filter(x => x.id !== el.dataset.id);
          commit(next);
        };
      });
      
      
      if ($('open-table')) {
        $('open-table').onclick = () => {
          $('table-dialog').showModal();
          renderTable();
        };
      }

      document.getElementById('add-expr').onclick = () => {
        const next = getInputs();
        const colors = ['#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#6d6875'];
        next.graph.expressions.push({
          id: 'g' + Date.now(),
          expr: 'x',
          color: colors[next.graph.expressions.length % colors.length],
          visible: true
        });
        commit(next);
      };

      let baseParams = null;
      [...target.querySelectorAll('.param-slider')].forEach(el => {
        el.onpointerdown = () => { baseParams = structuredClone(doc); };
        el.oninput = e => {
          baseParams ??= structuredClone(doc);
          const p = doc.graph.params.find(x => x.name === el.dataset.name);
          if (p) {
            p.value = Number(e.target.value);
            el.previousElementSibling.firstElementChild.textContent = p.name + ' = ' + p.value;
            renderCanvas();
          }
        };
        el.onchange = e => {
          const drafts=[...target.querySelectorAll('.expr-val')].map(input=>[input.dataset.id,input.value]);
          let next=getInputs(),unfinished=false;
          try{validateDocument(next);}catch{unfinished=true;next=structuredClone(doc);}
          if(baseParams)doc=baseParams;
          const parameter=next.graph.params.find(p=>p.name===el.dataset.name);if(parameter)parameter.value=Number(e.target.value);
          commit(next);baseParams=null;
          if(unfinished)for(const [id,value]of drafts){const input=[...$('properties').querySelectorAll('.expr-val')].find(el=>el.dataset.id===id);if(input)input.value=value;}
        };
      });
      
      [...target.querySelectorAll('.param-del')].forEach(el => {
        el.onclick = e => {
          const next = getInputs();
          next.graph.params = next.graph.params.filter(x => x.name !== el.dataset.name);
          commit(next);
        };
      });

      document.getElementById('add-param').onclick = () => {
        const name = prompt("Tên tham số (1 chữ cái a-z, khác x):");
        if (!name || !/^[a-wyz]$/.test(name)) return alert("Tên không hợp lệ");
        const next = getInputs();
        if (next.graph.params.some(p => p.name === name)) return alert("Tham số đã tồn tại");
        next.graph.params.push({ name, value: 1, min: -5, max: 5 });
        commit(next);
      };
    }else if(mode==='chart'){const c=doc.chart;target.innerHTML=field('Cách biểu diễn',`<select id="chart-type">${[['bar','Cột'],['double','Cột kép'],['line','Đoạn thẳng'],['pie','Quạt tròn'],['histogram','Histogram · khoảng đều']].map(([v,n])=>`<option value="${v}" ${c.type===v?'selected':''}>${n}</option>`).join('')}</select>`)+field('Dữ liệu: nhãn, giá trị'+(c.type==='double'?', dãy 2':''),`<textarea id="chart-data" rows="6">${escape(c.labels.map((v,i)=>v+', '+c.values[i]+(c.type==='double'?', '+c.second[i]:'')).join('\n'))}</textarea>`)+(c.type==='histogram'?'<div class="coordinates">'+field('Đầu khoảng',number('chart-start',c.start??0))+field('Độ rộng',number('chart-width',c.width??10,'min="0.001"'))+'</div>':'')+'<button id="apply-chart" class="primary full">Cập nhật biểu đồ</button><p class="tiny">Mỗi dòng một nhóm. Giá trị không âm. Histogram nhận tần số của các khoảng cùng độ rộng.</p>';
    const readChart=()=>{const next=structuredClone(doc),rows=$('chart-data').value.split('\n').map((v,i)=>({cells:v.split(',').map(s=>s.trim()),line:i+1})).filter(r=>r.cells.some(Boolean));
      if(!rows.length||rows.length>40)throw Error('Cần 1–40 dòng dữ liệu. Nhập nhãn và giá trị cho từng dòng.');
      for(const {cells:r,line}of rows){if(!r[0])throw Error('Dòng '+line+': thiếu nhãn. Nhập tên nhóm trước dấu phẩy.');if(r.length!==(c.type==='double'?3:2))throw Error('Dòng '+line+': cần '+(c.type==='double'?'nhãn, giá trị, dãy 2':'nhãn, giá trị')+'.');if(r.slice(1).some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0))throw Error('Dòng '+line+': giá trị phải là số không âm. Sửa dòng này rồi cập nhật.');}
      next.chart.enabled=true;next.chart.labels=rows.map(r=>r.cells[0]);next.chart.values=rows.map(r=>Number(r.cells[1]));next.chart.second=c.type==='double'?rows.map(r=>Number(r.cells[2])):next.chart.labels.map((_,i)=>c.second?.[i]??0);if(c.type==='histogram'){next.chart.start=Number($('chart-start').value);next.chart.width=Number($('chart-width').value);}return next;
    };
    $('chart-type').onchange=e=>{try{const next=readChart();next.chart.type=e.target.value;next.chart.start??=0;next.chart.width??=10;notify('');if(!commit(next))e.target.value=c.type;}catch(err){e.target.value=c.type;notify(err.message);}};
    $('apply-chart').onclick=()=>{try{notify('');commit(readChart());}catch(err){notify(err.message);}};
  }else{target.innerHTML=field('Khối hình',`<select id="solid-type">${Object.entries(solidNames).map(([v,n])=>`<option value="${v}" ${doc.solid.type===v?'selected':''}>${n}</option>`).join('')}</select>`)+(['pyramid','prism'].includes(doc.solid.type)?field('Số cạnh đáy đều',number('solid-sides',doc.solid.sides??(doc.solid.type==='prism'?3:4),'min="3" max="12" step="1"')):'')+field('Xoay ngang',`<input id="rotation" type="range" min="-180" max="180" value="${doc.solid.rotation}">`)+field('Góc nâng',`<input id="tilt" type="range" min="-80" max="80" value="${doc.solid.tilt}">`)+'<p class="tiny">Kéo hình để xoay. Cạnh khuất tự đổi nét đứt. Chưa hỗ trợ thiết diện / ràng buộc 3D.</p>';$('solid-type').onchange=e=>{const next=structuredClone(doc);next.solid.type=e.target.value;next.solid.enabled=true;delete next.solid.faceStyles;selectedFace=null;solidFaceMode=false;commit(next);};if($('solid-sides'))$('solid-sides').onchange=e=>{const next=structuredClone(doc);next.solid.sides=Number(e.target.value);delete next.solid.faceStyles;selectedFace=null;commit(next);};for(const id of ['rotation','tilt']){let before;$(id).onpointerdown=()=>before=structuredClone(doc);$(id).oninput=e=>{before??=structuredClone(doc);doc.solid[id]=Number(e.target.value);renderCanvas();};$(id).onchange=()=>{const next=structuredClone(doc);if(before)doc=before;commit(next);before=null;};}renderFaceControls(target);}
}
function renderFaceControls(target){
 const faces=[...$('canvas').querySelectorAll('[data-face]')].map(el=>Number(el.dataset.face)).sort((a,b)=>a-b);
 if(!faces.length)solidFaceMode=false;if(!faces.includes(selectedFace))selectedFace=null;
 const controls=document.createElement('fieldset');controls.id='face-controls';
 const style=doc.solid.faceStyles?.[selectedFace],disabled=selectedFace===null?'disabled':'';
 controls.innerHTML='<legend>Tô màu mặt hữu hạn</legend><label><input id="face-mode" type="checkbox" '+(solidFaceMode?'checked ':'')+(!faces.length?'disabled':'')+'> Chọn mặt · tắt để kéo xoay</label>';
 if(faces.length)controls.innerHTML+=field('Mặt của khối','<select id="solid-face"><option value="">Chưa chọn mặt</option>'+faces.map(i=>'<option value="'+i+'" '+(selectedFace===i?'selected':'')+'>Mặt '+(i+1)+'</option>').join('')+'</select>')+'<p id="selected-face-name" class="tiny">'+(selectedFace===null?'Chọn bằng danh sách hoặc bấm mặt trên hình.':'Đang chọn mặt '+(selectedFace+1))+'</p>'+field('Màu mặt','<input id="face-color" type="color" value="'+(style?.color||'#dfac48')+'" '+disabled+'>')+field('Độ đậm (0 = trong suốt, 1 = đặc)',number('face-opacity',style?.opacity??.35,'min="0" max="1" step="0.05" '+disabled))+'<button id="clear-face-color" class="secondary full" '+disabled+'>Bỏ màu mặt này</button><p class="tiny">Mặt hữu hạn của khối, không phải mặt phẳng vô hạn. Nón/trụ chỉ chọn đáy phẳng. Đổi loại khối hoặc số cạnh đáy xóa màu mặt cũ.</p>';
 else controls.innerHTML+='<p class="tiny">Hình cầu không có mặt phẳng hữu hạn để chọn. Kéo để xoay hình.</p>';
 target.append(controls);
 $('face-mode').onchange=e=>{solidFaceMode=e.target.checked;notify(solidFaceMode?'Bấm mặt hoặc chọn trong danh sách.':'Kéo hình để xoay.');};
 if(!faces.length)return;
 $('solid-face').onchange=e=>{selectedFace=e.target.value===''?null:Number(e.target.value);solidFaceMode=selectedFace!==null;render();};
 for(const id of ['face-color','face-opacity'])$(id).onchange=()=>{if(selectedFace===null)return;const next=structuredClone(doc);next.solid.faceStyles??={};next.solid.faceStyles[selectedFace]={color:$('face-color').value,opacity:Number($('face-opacity').value)};commit(next);};
 $('clear-face-color').onclick=()=>{const next=structuredClone(doc);if(next.solid.faceStyles)delete next.solid.faceStyles[selectedFace];commit(next);};
}
function editShape(key,value){const next=structuredClone(doc);next.shapes.find(s=>s.id===selected)[key]=value;commit(next);}
function deleteSelection(){
  if(mode==='geometry'&&selectedIds.size){const next=removeSelection(doc,selectedIds),points=doc.points.length-next.points.length,shapes=doc.shapes.length-next.shapes.length;requestDeletion(next,'Xóa tập chọn và phụ thuộc: '+points+' điểm, '+shapes+' hình/đường? Undo khôi phục toàn bộ lần xóa.');return;}
  if(mode!=='geometry'){const next=structuredClone(doc);if(next[mode==='graph'?'graph':mode==='chart'?'chart':'solid'].enabled===false)return;next[mode==='graph'?'graph':mode==='chart'?'chart':'solid'].enabled=false;requestDeletion(next,'Xóa '+(mode==='graph'?'đồ thị':mode==='chart'?'biểu đồ':'khối hình')+' khỏi bảng?');return;}
  const p=doc.points.find(p=>p.id===selected),s=doc.shapes.find(s=>s.id===selected);if(!p&&!s){selected='';render();return notify('Chọn điểm/đường hoặc dùng danh sách đối tượng trước khi xóa.');}
  const next=p?removePoint(doc,p.id):{...structuredClone(doc),shapes:doc.shapes.filter(q=>q.id!==s.id)};
  const pointCount=doc.points.length-next.points.length,shapeCount=doc.shapes.length-next.shapes.length;
  requestDeletion(next,`Xóa ${pointCount} điểm và ${shapeCount} hình/đường, gồm các phụ thuộc của ${p?p.label||p.id:names[s.type]+' '+s.refs.join(', ')}?`);
}
let deletion=null;
function requestDeletion(next,message){deletion={next,revision};$('delete-message').textContent=message;$('delete-dialog').showModal();}
function renderRestoreControl(){if(mode==='geometry')return;const key=mode==='graph'?'graph':mode==='chart'?'chart':'solid';if(doc[key].enabled===false){const b=document.createElement('button');b.id='restore-content';b.className='secondary full';b.textContent='Vẽ lại';b.onclick=()=>{const next=structuredClone(doc);next[key].enabled=true;commit(next);};$('properties').append(b);}}
function addPoint(x,y){const next=structuredClone(doc),id=freshId();next.points.push({id,x,y});selected=id;commit(next);}
function usePoint(id){if(tool==='select'||tool==='region'){selectedIds.clear();selected=id;render();return;}if(tool==='point')return;if(tool==='pan')return notify('Kéo nền để di chuyển khung.');notify('');const definition=tools.find(t=>t[0]===tool);
  if(tool==='polygon'&&id===pending[0]&&pending.length>=3){const next=structuredClone(doc);addShape(next,'polygon',pending);finishConstruction(next);return;}
  pending.push(id);if(definition[3]===-1||pending.length<definition[3]){render();return;}
  const next=structuredClone(doc),refs=[...pending];pending=[];
  if(['segment','line','ray','polygon','circle','vector','angle','length','dot','vectorAngle','vectorCoords'].includes(tool))addShape(next,tool,refs);
  else if(tool==='perpendicularBisector'){const mid=freshId(next);next.points.push({id:mid,kind:'midpoint',refs});const direction=freshId(next);next.points.push({id:direction,kind:'perpendicular',refs:[mid,...refs],visible:false});addShape(next,'line',[mid,direction]);}
  else{const id=freshId();next.points.push({id,kind:tool,refs,...(tool==='onLine'?{t:.5}:{}),...(['vectorScale','scaleFrom'].includes(tool)?{factor:.5}:{}),...(tool==='rotateAround'?{angle:Math.PI/2}:{}),...(tool==='translate'?{dx:2,dy:1}:{}),...(['onCircle','equal'].includes(tool)?{angle:0}:{}),...(['lineCircle','circleCircle','tangent'].includes(tool)?{branch:1}:{})});selected=id;if(tool==='foot')addShape(next,'segment',[refs[0],id],{dashed:true,color:'#d09232'});if(['parallel','perpendicular'].includes(tool))addShape(next,'line',[refs[0],id]);if(tool==='bisector')addShape(next,'line',[refs[1],id]);if(['equal','vectorSum','vectorDifference','vectorScale'].includes(tool))addShape(next,tool==='equal'?'segment':'vector',[refs[0],id]);if(tool==='tangent')addShape(next,'line',[refs[0],id]);if(tool==='circumcenter')addShape(next,'circle',[id,refs[0]]);if(tool==='incenter'){const footId=id+'_H';next.points.push({id:footId,kind:'foot',refs:[id,refs[0],refs[1]]});addShape(next,'circle',[id,footId]);}selected=id;}
  if(draftBefore)addSourceGuides(next,tool,refs);
  finishConstruction(next);
}
function addSourceGuides(next,tool,refs){
 const [a,b,c,d]=refs,guides={midpoint:[['segment',[a,b]]],perpendicularBisector:[['segment',[a,b]]],foot:[['line',[b,c]]],parallel:[['line',[b,c]]],perpendicular:[['line',[b,c]]],bisector:[['segment',[a,b]],['segment',[b,c]]],onLine:[['line',[a,b]]],onCircle:[['circle',[a,b]]],equal:[['segment',[b,c]]],intersection:[['line',[a,b]],['line',[c,d]]],lineCircle:[['line',[a,b]],['circle',[c,d]]],circleCircle:[['circle',[a,b]],['circle',[c,d]]],tangent:[['circle',[b,c]]],vectorSum:[['vector',[a,b]],['vector',[c,d]]],vectorDifference:[['vector',[a,b]],['vector',[c,d]]],vectorScale:[['vector',[b,c]]],dot:[['vector',[a,b]],['vector',[c,d]]],vectorAngle:[['vector',[a,b]],['vector',[c,d]]],vectorCoords:[['vector',[a,b]]],reflectAxis:[['line',[b,c]]]};
 const result=selected;for(const [type,source]of guides[tool]||[]){const exists=next.shapes.some(s=>s.type===type&&((s.refs[0]===source[0]&&s.refs[1]===source[1])||(type!=='circle'&&type!=='vector'&&s.refs[1]===source[0]&&s.refs[0]===source[1])));if(!exists)addShape(next,type,source,{dashed:true,color:'#789589'});}selected=result;
}
function useShape(id){const shape=doc.shapes.find(s=>s.id===id);let accepted=false;
 const lineLike=['line','segment','ray','vector'].includes(shape.type),circle=shape.type==='circle';
 if(['onLine','midpoint','perpendicularBisector','length'].includes(tool)&&lineLike&&pending.length===0)accepted=true;
 if(tool==='onCircle'&&circle&&pending.length===0)accepted=true;
 if(['parallel','perpendicular','foot','reflectAxis'].includes(tool)&&lineLike&&pending.length===1)accepted=true;
 if(tool==='tangent'&&circle&&pending.length===1)accepted=true;
 if(tool==='intersection'&&lineLike&&[0,2].includes(pending.length))accepted=true;
 if(tool==='lineCircle'&&((lineLike&&pending.length===0)||(circle&&pending.length===2)))accepted=true;
 if(tool==='circleCircle'&&circle&&[0,2].includes(pending.length))accepted=true;
 if(['vectorSum','vectorDifference','dot','vectorAngle'].includes(tool)&&shape.type==='vector'&&[0,2].includes(pending.length))accepted=true;
 if(tool==='vectorScale'&&shape.type==='vector'&&pending.length===1)accepted=true;
 if(accepted){notify('');for(const ref of shape.refs.slice(0,2))usePoint(ref);}else notify('Công cụ '+names[tool]+' chưa nhận đối tượng này ở bước '+(pending.length+1)+'. '+tools.find(t=>t[0]===tool)[4]+'. Chọn các điểm theo thứ tự hoặc nhấn Esc để hủy.');
}
function svgCoords(e){const canvas=$('canvas'),svg=canvas.querySelector('svg'),p=svg.createSVGPoint(),box=canvas.getBoundingClientRect();p.x=Math.max(box.left,Math.min(box.right,e.clientX));p.y=Math.max(box.top,Math.min(box.bottom,e.clientY));const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y};}
function visibleCanvasBounds(){const b=$('canvas').getBoundingClientRect(),a=svgCoords({clientX:b.left,clientY:b.top}),z=svgCoords({clientX:b.right,clientY:b.bottom});return{x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y};}
function updateCanvasGrid(){const canvas=$('canvas');canvas.style.backgroundImage=mode==='geometry'&&$('grid').checked?'radial-gradient(circle, #cddcd5 1px, transparent 1px)':'none';if(mode!=='geometry')return;const svg=canvas.querySelector('svg'),matrix=svg.getScreenCTM(),b=canvas.getBoundingClientRect(),step=25*(scale/55)*matrix.a,p=svg.createSVGPoint();p.x=500;p.y=330;const origin=p.matrixTransform(matrix);canvas.style.backgroundSize=step+'px '+step+'px';canvas.style.backgroundPosition=(origin.x-b.left-step/2)+'px '+(origin.y-b.top-step/2)+'px';}
new ResizeObserver(()=>{if(!$('canvas').clientWidth||!$('canvas').clientHeight)return;renderCanvas();if(drag?.region)drawMarquee();}).observe($('canvas'));
function selectionRect(a,b){return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)};}
function drawMarquee(){const svg=$('canvas').querySelector('svg');let box=svg.querySelector('#selection-marquee');if(!box){box=document.createElementNS('http://www.w3.org/2000/svg','rect');box.id='selection-marquee';box.setAttribute('fill','#dfac4830');box.setAttribute('stroke','#b07519');box.setAttribute('stroke-width','2');box.setAttribute('stroke-dasharray','6 4');box.setAttribute('pointer-events','none');svg.append(box);}const r=selectionRect(drag.start,drag.current);for(const [key,value]of Object.entries({x:r.x,y:r.y,width:r.right-r.x,height:r.bottom-r.y}))box.setAttribute(key,value);}
function objectsInRect(a,b){const r=selectionRect(a,b),chosen=new Set(),inside=(x,y)=>x>=r.x&&x<=r.right&&y>=r.y&&y<=r.bottom,points=resolve(doc).points;
 for(const p of Object.values(points))if(p.visible!==false&&inside(500+p.x*scale,330-p.y*scale))chosen.add(p.id);
 for(const el of $('canvas').querySelectorAll('[data-shape]')){if(el.getAttribute('stroke')==='transparent')continue;const shape=doc.shapes.find(s=>s.id===el.dataset.shape);if(!shape)continue;const box=el.getBBox();if(box.x>r.right||box.y>r.bottom||box.x+box.width<r.x||box.y+box.height<r.y)continue;
 if(['line','ray'].includes(shape.type)){const [a,b]=shape.refs.map(id=>points[id]);if(!a||!b)continue;const origin={x:500+a.x*scale,y:330-a.y*scale},direction={x:(b.x-a.x)*scale,y:-(b.y-a.y)*scale};let lo=shape.type==='ray'?0:-Infinity,hi=Infinity;for(const [axis,min,max]of [['x',r.x,r.right],['y',r.y,r.bottom]]){const v=direction[axis];if(Math.abs(v)<1e-8){if(origin[axis]<min||origin[axis]>max)hi=-Infinity;}else{const t1=(min-origin[axis])/v,t2=(max-origin[axis])/v;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}}if(lo<=hi)chosen.add(shape.id);
 }else{const bounds=el.getBBox();if(inside(bounds.x,bounds.y)&&inside(bounds.x+bounds.width,bounds.y+bounds.height))chosen.add(shape.id);}}
 return [...chosen];}
function renderGroupProperties(target){const points=doc.points.filter(p=>selectedIds.has(p.id)),shapes=doc.shapes.filter(s=>selectedIds.has(s.id)),strokes=shapes.filter(s=>!['length','dot','vectorAngle','vectorCoords'].includes(s.type));
 target.innerHTML='<p id="selection-count" role="status">'+points.length+' điểm · '+shapes.length+' hình/đường được chọn</p>'+(shapes.length?field('Màu '+shapes.length+' hình/đường','<input id="multi-color" type="color" value="'+(shapes[0].color||'#176b52')+'">'):'')+(strokes.length?'<label class="check"><input id="multi-dashed" type="checkbox"> Nét đứt cho '+strokes.length+' hình có nét</label>':'')+(points.length?'<label class="check"><input id="multi-labels" type="checkbox"> Hiện nhãn '+points.length+' điểm</label>':'')+'<label class="check"><input id="multi-visible" type="checkbox"> Hiển thị tập chọn</label><button id="delete-group" class="secondary full delete">Xóa tập chọn…</button><button id="clear-group" class="secondary full">Bỏ chọn</button><p class="tiny">Hình hữu hạn phải nằm trọn trong khung; đường/tia chọn khi cắt khung. Xóa điểm nguồn sẽ xóa cả phụ thuộc ngoài vùng. Màu/nét áp dụng cho hình; nhãn áp dụng cho điểm. Không di chuyển hoặc biến hình cả nhóm.</p>';
 const check=(id,objects,key)=>{if(!$(id))return;const values=objects.map(o=>o[key]!==false);$(id).checked=values.every(Boolean);$(id).indeterminate=values.some(Boolean)&&!values.every(Boolean);};
 check('multi-labels',points,'labelVisible');check('multi-visible',[...points,...shapes],'visible');if($('multi-dashed')){$('multi-dashed').checked=strokes.every(s=>s.dashed===true);$('multi-dashed').indeterminate=strokes.some(s=>s.dashed===true)&&!strokes.every(s=>s.dashed===true);}
 const apply=(objects,key,value)=>{const ids=new Set(objects.map(o=>o.id)),next=structuredClone(doc);for(const o of [...next.points,...next.shapes])if(ids.has(o.id))o[key]=value;commit(next,{keepSelection:true});};
 if($('multi-color'))$('multi-color').onchange=e=>apply(shapes,'color',e.target.value);if($('multi-dashed'))$('multi-dashed').onchange=e=>apply(strokes,'dashed',e.target.checked);if($('multi-labels'))$('multi-labels').onchange=e=>apply(points,'labelVisible',e.target.checked);$('multi-visible').onchange=e=>apply([...points,...shapes],'visible',e.target.checked);$('delete-group').onclick=deleteSelection;$('clear-group').onclick=()=>{selectedIds.clear();selected='';render();};
}
function coords(e){const svg=$('canvas').querySelector('svg'),p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:(q.x-500)/scale,y:(330-q.y)/scale};}
$('canvas').addEventListener('pointerdown',e=>{if(e.button!==0)return;const point=e.target.closest('[data-point]')?.dataset.point,shape=e.target.closest('[data-shape]')?.dataset.shape;
  if(mode==='solid'){if(solidFaceMode){const face=e.target.closest('[data-face]')?.dataset.face;if(face!==undefined){selectedFace=Number(face);notify('Đã chọn mặt '+(selectedFace+1)+'. Chỉnh màu và độ đậm trong sidebar.');render();}else notify('Chọn bên trong một mặt hữu hạn của khối hoặc chọn trong danh sách. Tắt Chọn mặt để kéo xoay.');return;}drag={before:structuredClone(doc),px:e.clientX,py:e.clientY,solid:true};$('canvas').setPointerCapture(e.pointerId);return;}
  if(mode!=='geometry')return;if(tool==='pan'||e.shiftKey){const svg=$('canvas').querySelector('svg');drag={pan:true,before:structuredClone(doc),base:{...pan},sx:e.clientX,sy:e.clientY,factor:svg.getScreenCTM().a};$('canvas').setPointerCapture(e.pointerId);return;}
  if(tool==='region'){drag={region:true,start:svgCoords(e),current:svgCoords(e),px:e.clientX,py:e.clientY,clickId:point||shape,previous:[...selectedIds]};selected='';selectedIds.clear();$('canvas').setPointerCapture(e.pointerId);renderCanvas();drawMarquee();return;}selectedIds.clear();
  if(point){if(tool!=='select')return usePoint(point);selected=point;const p=doc.points.find(p=>p.id===point);if(!p.kind||['onLine','onCircle'].includes(p.kind)){drag={id:point,before:structuredClone(doc),start:coords(e),pointer:e.pointerId};$('canvas').setPointerCapture(e.pointerId);}render();}
  else if(shape&&tool!=='select'&&tool!=='point'){useShape(shape);return;}else if(tool==='point'){const q=coords(e);addPoint(Math.round(q.x*10)/10,Math.round(q.y*10)/10);} else if(tool!=='select'){
  // Clicked on empty space while drawing
  draftBefore??=structuredClone(doc);
  const clickPoint=coords(e),resolvedPoints=resolve(doc).points;
  let selectedPoint=Object.values(resolvedPoints).find(p=>p.visible!==false&&Math.hypot(p.x-clickPoint.x,p.y-clickPoint.y)<.2)?.id;
  if (!selectedPoint) {
    const {x, y} = coords(e);
    selectedPoint = freshId();
    doc.points.push({id: selectedPoint, x, y});
  }
  usePoint(selectedPoint);
}
  else if(shape&&tool==='select'){selected=shape;render();}else if(tool==='select'){selected='';render();}else notify('Cho phép dựng từ điểm có sẵn. Chọn công cụ Điểm để tạo thêm.');
});
$('canvas').addEventListener('pointermove',e=>{
  if(drag?.region){drag.current=svgCoords(e);drag.moved=Math.hypot(e.clientX-drag.px,e.clientY-drag.py)>4;drawMarquee();return;}
  if(!drag){
    if (mode === 'geometry' && pending.length > 0) {
      let {x, y} = coords(e);
      snappedPointId = null;
      let minDist = 0.27;
      const resolved = resolve(doc).points;
      for (const p of doc.points) {
        const rp = resolved[p.id];
        if (!rp||p.visible===false) continue;
        const dist = Math.hypot(rp.x - x, rp.y - y);
        if (dist < minDist) { minDist = dist; x = rp.x; y = rp.y; snappedPointId = p.id; }
      }
      const vDoc = structuredClone(doc);
      const ghostId = 'GHOST_POINT';
      vDoc.points.push({id: ghostId, x, y, visible:false});
      if(tool==='polygon')addShape(vDoc,pending.length>1?'polygon':'segment',[...pending,ghostId]);
      if (['segment','line','ray','vector','circle'].includes(tool)) addShape(vDoc, tool==='vector'?'vector':tool, [pending[0], ghostId]);
      if (['parallel','perpendicular'].includes(tool)) addShape(vDoc, 'line', [pending[0], ghostId]);
      
      const lastShape = vDoc.shapes[vDoc.shapes.length - 1];
      if (lastShape && lastShape.refs.includes(ghostId)) lastShape.color = '#888888';
      renderCanvas(vDoc, snappedPointId);
    }
    return;
  }
  if(drag.pan){pan.x=drag.base.x-(e.clientX-drag.sx)/drag.factor;pan.y=drag.base.y-(e.clientY-drag.sy)/drag.factor;renderCanvas();return;}if(drag.solid){doc.solid.rotation=((drag.before.solid.rotation+(e.clientX-drag.px)*.6+540)%360)-180;doc.solid.tilt=Math.max(-80,Math.min(80,drag.before.solid.tilt-(e.clientY-drag.py)*.4));}else{const q=coords(e);doc=movePoint(doc,drag.id,q.x,q.y);}renderCanvas();
});
$('canvas').addEventListener('mouseleave', () => { if (pending.length > 0) renderCanvas(doc); });

function endDrag(cancel=false){if(!drag)return;if(drag.region){const region=drag;drag=null;selectedIds.clear();for(const id of cancel?region.previous:region.moved?objectsInRect(region.start,region.current):region.clickId?[region.clickId]:[])selectedIds.add(id);selected='';if(selectedIds.size){sidebarView='properties';syncSidebarTabs();}render();notify(selectedIds.size?'Đã chọn '+selectedIds.size+' đối tượng. Mở Đối tượng để chỉnh chung hoặc nhấn Delete để xóa.':'Vùng không có đối tượng phù hợp. Kéo khung lớn hơn hoặc bấm một đối tượng.');return;}if(drag.pan){if(cancel)pan=drag.base;drag=null;render();return;}const next=structuredClone(doc),before=drag.before;doc=before;drag=null;if(cancel){render();return;}if(JSON.stringify(next)!==JSON.stringify(before))commit(next);else render();}
$('canvas').addEventListener('pointerup',()=>endDrag());$('canvas').addEventListener('pointercancel',()=>endDrag(true));
$('canvas').addEventListener('keydown',e=>{const id=e.target.closest('[data-point]')?.dataset.point;if(!id)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();usePoint(id);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const p=resolve(doc).points[id];selected=id;commit(movePoint(doc,id,p.x+(e.key==='ArrowRight'?.1:e.key==='ArrowLeft'?-.1:0),p.y+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)));$('canvas').querySelector(`[data-point="${id}"]`)?.focus();}});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{endDrag();cancelConstruction();selectedIds.clear();selected='';mode=b.dataset.mode;sidebarView=mode==='geometry'?'tools':'properties';syncSidebarTabs();render();});
$('undo').onclick=()=>{cancelConstruction();selectedIds.clear();if(history.length){future.push(doc);doc=history.pop();revision++;selected='';pending=[];persist();render();}};$('redo').onclick=()=>{cancelConstruction();selectedIds.clear();if(future.length){history.push(doc);doc=future.pop();revision++;selected='';pending=[];persist();render();}};
document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||e.target.isContentEditable||document.querySelector('dialog[open]'))return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}if(e.key==='Escape'){endDrag(true);cancelConstruction();selectedIds.clear();selected='';notify('');tool='select';render();}});
for(const[id,factor]of [['zoom-in',1.2],['zoom-out',1/1.2]])$(id).onclick=()=>{scale=Math.max(15,Math.min(160,scale*factor));render();};$('reset-view').onclick=()=>{scale=55;pan={x:0,y:0};render();};$('grid').onchange=render;
$('title').onchange=e=>{const title=e.target.value;cancelConstruction();commit({...doc,title});};


const modeNames={geometry:'Hình học',graph:'Đồ thị',chart:'Thống kê',solid:'Không gian'};
const templateCategories={};
function renderGallery(){
 const entries=templateLibrary[mode],categories=[...new Set(entries.map(t=>t.category))];
 const category=templateCategories[mode]||categories[0];templateCategories[mode]=category;
 $('templates-title').textContent='Hình mẫu · '+modeNames[mode];
 $('template-info').textContent=entries.length+' mẫu '+modeNames[mode].toLowerCase()+'. Chỉ thay nội dung chế độ đang mở; giữ nguyên ba chế độ còn lại. Có thể hoàn tác.';
 $('template-categories').innerHTML=categories.map(name=>`<button data-category="${name}" aria-label="${name}" class="${category===name?'active':''}" aria-pressed="${category===name}">${name} <span aria-hidden="true">${entries.filter(t=>t.category===name).length}</span></button>`).join('');
 const search=normalize($('template-search').value);
 const items=entries.filter(t=>(search||t.category===category)&&normalize(t.label+' '+t.description+' '+t.category).includes(search));
 $('template-gallery').innerHTML=items.map(item=>{
  const next=applyLibraryTemplate(emptyDocument(),mode,item.id);
  const svg=mode==='geometry'?renderSVG(next,{grid:false,scale:68}):mode==='graph'?graphSVG(next.graph,{grid:true,scale:55}):mode==='chart'?chartSVG(next.chart):solidSVG(next.solid);
  const preview=svg.replace(/tabindex="0" role="button"/g,'').replace('role="img"','aria-hidden="true"');
  return `<button class="template-card" data-template="${item.id}" data-template-mode="${mode}" aria-label="${escape(item.label)}"><div class="template-preview">${preview}</div><strong>${escape(item.label)}</strong><p>${escape(item.description)}</p><span class="template-use">Dùng mẫu này ↗</span></button>`;
 }).join('');$('template-empty').hidden=items.length>0;
 $('template-legend').textContent=mode==='geometry'?'Điểm xanh: nguồn · Điểm vàng: phụ thuộc':mode==='chart'?'Số liệu minh họa · chỉnh trong Đối tượng':mode==='graph'?'Sửa biểu thức / tham số trong Đối tượng':'Kéo khối để xoay · chưa có dựng thiết diện';
}
$('open-templates').onclick=()=>{$('template-search').value='';renderGallery();$('templates-dialog').showModal();};
$('template-search').oninput=renderGallery;
$('template-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){templateCategories[mode]=b.dataset.category;$('template-search').value='';renderGallery();}};
function applyGallery(value){try{cancelConstruction();selected='';if(!commit(applyLibraryTemplate(doc,mode,value)))return;sidebarView=mode==='geometry'?'tools':'properties';syncSidebarTabs();render();$('templates-dialog').close();closeMobileSidebar();}catch(e){notify(e.message);}}
$('template-gallery').onclick=e=>{const b=e.target.closest('[data-template]');if(b)applyGallery(b.dataset.template);};
$('blank-template').onclick=()=>applyGallery('blank');

function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>{cancelConstruction();render();download(JSON.stringify(doc,null,2),'ve-hinh.json','application/json');};$('load').onclick=()=>$('document-file').click();$('document-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1e6)throw Error('File tối đa 1 MB');const next=validateDocument(JSON.parse(await file.text()));selected='';pending=[];if(commit(next))notify('Đã mở tài liệu. Có thể hoàn tác về bản trước.');}catch(err){notify('Không mở file: '+err.message);}finally{e.target.value='';}};
$('export').onclick=()=>{cancelConstruction();render();$('export-dialog').showModal();};$('export-svg').onclick=()=>{download(exportSVG(doc,mode,{scale,pan,viewport:mode==='geometry'?visibleCanvasBounds():undefined}),'ve-hinh-'+mode+'.svg','image/svg+xml');$('export-dialog').close();};$('export-png').onclick=async()=>{try{const url=URL.createObjectURL(new Blob([exportSVG(doc,mode,{scale,pan,viewport:mode==='geometry'?visibleCanvasBounds():undefined})],{type:'image/svg+xml'}));const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=2000;const bounds=mode==='geometry'?visibleCanvasBounds():{width:1000,height:660};c.height=Math.max(1,Math.round(c.width*bounds.height/bounds.width));c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw Error('Không tạo được PNG');download(blob,'ve-hinh-'+mode+'.png','image/png');$('export-dialog').close();}catch(e){notify('Xuất PNG thất bại: '+e.message);}};
$('help').onclick=()=>$('help-dialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
async function loadImage(file){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))return notify('Chọn ảnh PNG, JPEG hoặc WebP');if(file.size>4*1024*1024)return notify('Ảnh tối đa 4 MB. Cắt rõ cả đề bài và hình.');try{const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Không đọc được ảnh'));r.readAsDataURL(file);});const test=new Image();test.src=data;await test.decode();image=data;$('source-image').src=data;$('source-image').hidden=false;$('remove-image').hidden=false;notify('Ảnh đang ở thiết bị; chỉ gửi khi bạn bấm tạo bản đề xuất.');}catch(e){notify(e.message);}}
for(const id of ['book-image','camera-image'])$(id).onchange=e=>loadImage(e.target.files[0]);$('remove-image').onclick=()=>{image=null;$('source-image').hidden=true;$('source-image').removeAttribute('src');$('remove-image').hidden=true;$('book-image').value='';$('camera-image').value='';};
for(const evt of ['dragover','dragenter'])$('dropzone').addEventListener(evt,e=>{e.preventDefault();$('dropzone').classList.add('over');});$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('over'));$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('over');loadImage(e.dataTransfer.files[0]);});
$('analyze').onclick=async()=>{
  if(busy)return;
  cancelConstruction();
  render();
  const prompt=$('prompt').value.trim();
  if(!prompt&&!image)return notify('Vui lòng nhập ý tưởng đề bài hoặc tải ảnh để AI vẽ');
  busy=true;
  $('analyze').disabled=true;
  $('analyze').textContent='Đang phân tích và vẽ hình với AI…';
  const before=revision,originalImage=image;
  try{
    const result=await requestProposal({prompt,document:doc,image:originalImage});
    if(before!==revision)throw Error('Bản vẽ đã đổi trong lúc AI làm việc. Hãy thử lại để tránh ghi đè.');
    selected='';
    pending=[];
    if(commit(result.document)){
      if(result.document.graph && result.document.graph.expression && mode!=='graph') mode='graph';
      else if(result.document.solid && result.document.solid.type && mode!=='solid') mode='solid';
      else if(result.document.chart && result.document.chart.values && result.document.chart.values.length && mode!=='chart') mode='chart';
      else mode='geometry';
      sidebarView=mode==='geometry'?'tools':'properties';
      syncSidebarTabs();
      render();
      notify('✨ Đã vẽ hình tự động thành công! Nhấn ↶ (hoàn tác) để xem lại bản trước nếu cần.');
      if(!testing)window.parent.word2latexDrawingLog?.('Vẽ hình: tự động vẽ AI');
    } else {
      notify('Không thể áp dụng bản vẽ.');
    }
  }catch(e){
    notify('Lỗi tạo hình AI: '+e.message);
  }finally{
    busy=false;
    $('analyze').disabled=false;
    $('analyze').textContent='✨ Vẽ hình với AI';
  }
};
for(const id of ['close-review','cancel-review'])$(id).onclick=()=>{proposal=null;$('review').close();if(!testing)window.parent.word2latexDrawingLog?.('Vẽ hình: hủy đề xuất');};$('review').addEventListener('cancel',()=>{proposal=null;if(!testing)window.parent.word2latexDrawingLog?.('Vẽ hình: hủy đề xuất');});$('confirm-review').onclick=()=>{if(!proposal)return;if(proposal.revision!==revision){notify('Bản gốc đã đổi; phân tích lại để áp dụng an toàn.');$('review').close();proposal=null;return;}selected='';pending=[];if(commit(proposal.document)){mode='geometry';render();$('review').close();proposal=null;notify('Đã áp dụng bản đề xuất đã xác nhận. Có thể hoàn tác.');if(!testing)window.parent.word2latexDrawingLog?.('Vẽ hình: áp dụng AI');}};
fetch('/api/ve-hinh?action=config').then(r=>r.json()).then(c=>{if(!c.configured){$('ai-status').hidden=false;$('ai-status').textContent='Chưa tìm thấy GEMINI_API_KEY trên server.';}}).catch(()=>{});
function showProposal(result,before,originalImage){proposal={...result,revision:before};$('proposal-canvas').innerHTML=renderSVG(result.document);renderProposalWorkspaces(result.document);$('extracted').textContent=result.extractedText||'Không có văn bản được trả về';$('uncertainties').replaceChildren(...result.uncertainties.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));if(!result.uncertainties.length){const li=document.createElement('li');li.textContent='Provider không liệt kê nghi vấn. Vẫn kiểm tra toàn bộ nhãn và điều kiện.';$('uncertainties').append(li);}const errors=resolve(result.document).errors;$('proposal-errors').textContent=errors.length?'Cấu hình chưa xác định: '+errors.join('; '):'';$('confirm-review').disabled=errors.length>0;$('review-source').hidden=!originalImage;$('no-source').hidden=!!originalImage;if(originalImage)$('review-source').src=originalImage;else $('review-source').removeAttribute('src');$('review').showModal();}
const workspaceReview=document.getElementById('workspace-review-template').content.cloneNode(true);$('extracted').previousElementSibling.before(workspaceReview);
function renderProposalWorkspaces(next){let html=`<h3>Toàn bộ thay đổi sẽ áp dụng</h3><p>Tên: ${escape(doc.title)} → ${escape(next.title)}. Điểm ${doc.points.length} → ${next.points.length}; hình/đường ${doc.shapes.length} → ${next.shapes.length}.</p>`;for(const [key,label,renderer]of [['graph','Đồ thị',graphSVG],['chart','Thống kê',chartSVG],['solid','Không gian',solidSVG]]){if(JSON.stringify(doc[key])===JSON.stringify(next[key])){html+=`<p>${label}: giữ nguyên.</p>`;continue;}html+=`<details open><summary>${label}: có thay đổi</summary><div class="compare"><figure><figcaption>Hiện tại</figcaption>${renderer(doc[key])}</figure><figure><figcaption>Đề xuất</figcaption>${renderer(next[key])}</figure></div><p>Dữ liệu hiện tại: ${escape(JSON.stringify(doc[key]))}</p><p>Dữ liệu đề xuất: ${escape(JSON.stringify(next[key]))}</p></details>`;}$('proposal-workspaces').innerHTML=html;}
$('export-json').onclick=()=>{download(JSON.stringify(doc,null,2),'ve-hinh.json','application/json');$('export-dialog').close();};
const deleteButton=document.createElement('button');deleteButton.id='delete-selected';deleteButton.className='delete';deleteButton.textContent='Xóa';deleteButton.title='Xóa đối tượng đã chọn · Delete';deleteButton.onclick=deleteSelection;document.querySelector('.canvas-bar').append(deleteButton);
$('confirm-delete').onclick=()=>{if(deletion&&deletion.revision===revision){selected='';pending=[];commit(deletion.next);}else notify('Tài liệu đã đổi; chọn lại đối tượng cần xóa.');deletion=null;$('delete-dialog').close();};
const detailsButton=document.createElement('button');detailsButton.id='toggle-details';detailsButton.textContent='Đối tượng';detailsButton.title='Mở thuộc tính trong sidebar';detailsButton.onclick=()=>{cancelConstruction();sidebarView=sidebarView==='properties'?'tools':'properties';setSidebar(true);syncSidebarTabs();render();};document.querySelector('.canvas-bar').append(detailsButton);
render();


  // Table Logic
  const renderTable = () => {
    if (!doc.graph) return;
    const start = Number($('table-start').value);
    const end = Number($('table-end').value);
    const step = Number($('table-step').value);
    if (step <= 0 || start > end || (end - start)/step > 1000) {
      return notify('Khoảng và bước không hợp lệ (tối đa 1000 dòng)');
    }
    
    const rows = generateTable(doc.graph.expressions, doc.graph.params, start, end, step);
    const visExprs = tableExpressions(doc.graph.expressions);
    $('table-note').textContent=visExprs.length<doc.graph.expressions.filter(e=>e.visible!==false).length?'Bảng chỉ nhận hàm y=f(x). Phương trình ẩn và bất phương trình không có một giá trị y duy nhất, nên được bỏ khỏi bảng.':'Bảng tính y theo x. Dấu – nghĩa là hàm không xác định tại x đó.';
    
    let th = '<th style="padding:8px; border-bottom:1px solid #ccc;">x</th>';
    visExprs.forEach((e, i) => {
      th += '<th style="padding:8px; border-bottom:1px solid #ccc; color:' + (e.color||'#176b52') + '">Hàm ' + (i+1) + '</th>';
    });
    $('table-head').innerHTML = '<tr>' + th + '</tr>';
    
    let tbody = '';
    rows.forEach(r => {
      let tr = '<td style="padding:6px 8px; border-bottom:1px solid #eee;">' + r.x + '</td>';
      visExprs.forEach(e => {
        const val = r[e.id];
        tr += '<td style="padding:6px 8px; border-bottom:1px solid #eee;">' + (val === null ? '-' : val.toFixed(4)) + '</td>';
      });
      tbody += '<tr>' + tr + '</tr>';
    });
    $('table-body').innerHTML = tbody;
  };
  
  if ($('open-table')) {
    $('open-table').onclick = () => {
      $('table-dialog').showModal();
      renderTable();
    };
  }
  
  ['table-start', 'table-end', 'table-step'].forEach(id => {
    if ($(id)) $(id).onchange = renderTable;
  });


  window.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select, [contenteditable]')) return;
    if(document.querySelector('dialog[open]'))return;
    if (e.key.toLowerCase() === 'g') { if ($('grid')) { $('grid').click(); } return; }
    if (e.key.toLowerCase() === 'f') { if ($('reset-view')) { $('reset-view').click(); } return; }
  });


  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.display = 'none';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.background = 'rgba(0,0,0,0.8)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '4px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '12px';
  tooltip.style.zIndex = '1000';
  document.body.appendChild(tooltip);

  $('canvas').addEventListener('mouseover', e => {
    const pTarget = e.target.closest('[data-point]');
    const sTarget = e.target.closest('[data-shape]');
    if (pTarget) {
      const pid = pTarget.getAttribute('data-point');
      const point = doc.points.find(p => p.id === pid);
      if (point) {
        tooltip.textContent = (point.label || pid) + (point.kind ? ' (' + names[point.kind] + ')' : '');
        tooltip.style.display = 'block';
      }
    } else if (sTarget) {
      const sid = sTarget.getAttribute('data-shape');
      const shape = doc.shapes.find(s => s.id === sid);
      if (shape) {
        tooltip.textContent = names[shape.type] + ' ' + shape.refs.join('');
        tooltip.style.display = 'block';
      }
    }
  });
  $('canvas').addEventListener('mousemove', e => {
    if (tooltip.style.display === 'block') {
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY + 10 + 'px';
    }
  });
  $('canvas').addEventListener('mouseout', e => {
    tooltip.style.display = 'none';
  });


  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  if ($('toggle-theme')) {
    $('toggle-theme').onclick = () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
  }


window.renderLatexPreview = function(source, container) {
  if (!container) return;
  if (typeof window.katex === 'undefined') {
    container.textContent = source || '';
    return;
  }
  try {
    window.katex.render(exprToLatex(source), container, {
      throwOnError: false,
      displayMode: false,
      errorColor: '#cc0000'
    });
  } catch {
    container.textContent = source || '';
  }
};
