import {resolve} from './math.js';
import {compileExpression, compileExpressionP, detectExpressionType, normalizeToLHS} from './expression.js';
import {screen3D, project3D} from './engine3d/projection.js';
import {evaluatePolyhedronEdges, evaluateSegmentOcclusion, resolveSegmentDashed, orientPolyhedronFaces, edgeKey} from './engine3d/occlusion.js';
import {computeLabelPlacement3D} from './engine3d/label3d.js';
import {getStandardSolidGeometry} from './engine3d/tikz3d.js';

export {screen3D, project3D, computeLabelPlacement3D};
export const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const W=1000,H=660;
export const screen=(p,scale=55)=>({x:W/2+p.x*scale,y:H/2-p.y*scale});
const line=(a,b,attrs='')=>`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;
const text=(x,y,t,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${escape(t)}</text>`;
const wrapper=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bảng vẽ toán học"><rect width="1000" height="660" fill="#ffffff"/><defs><pattern id="dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cddcd5"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs><style>text{font:18px system-ui,sans-serif;fill:#27483c} .label{font-weight:600;font-style:italic} .point{cursor:grab} .point:focus{outline:none} .point:focus circle{stroke:#dfac48;stroke-width:4}</style>${body}</svg>`;

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function computeLabelPlacement(p, neighbors = [], segments = [], circles = [], placedLabels = [], pointId = '') {
  const angles = [];
  for (const n of neighbors) {
    if (!n) continue;
    const dx = n.x - p.x, dy = n.y - p.y;
    if (Math.hypot(dx, dy) > 1e-3) angles.push(Math.atan2(dy, dx));
  }

  const candidateAngles = [];
  if (angles.length >= 2) {
    const norm = angles.map(a => (a < 0 ? a + 2 * Math.PI : a)).sort((a, b) => a - b);
    for (let i = 0; i < norm.length; i++) {
      const a1 = norm[i];
      const a2 = i === norm.length - 1 ? norm[0] + 2 * Math.PI : norm[i + 1];
      const gap = a2 - a1;
      const bisector = (a1 + gap / 2) % (2 * Math.PI);
      candidateAngles.push(bisector);
      if (gap > Math.PI * 0.8) {
        candidateAngles.push((bisector - Math.PI / 6 + 2 * Math.PI) % (2 * Math.PI));
        candidateAngles.push((bisector + Math.PI / 6) % (2 * Math.PI));
      }
    }
  } else if (angles.length === 1) {
    const opp = (angles[0] + Math.PI) % (2 * Math.PI);
    candidateAngles.push(opp, (opp - Math.PI / 4 + 2 * Math.PI) % (2 * Math.PI), (opp + Math.PI / 4) % (2 * Math.PI));
  }

  for (const c of circles) {
    const dist = Math.hypot(p.x - c.center.x, p.y - c.center.y);
    if (Math.abs(dist - c.r) < 6) {
      const radial = Math.atan2(p.y - c.center.y, p.x - c.center.x);
      candidateAngles.push(radial, (radial + Math.PI) % (2 * Math.PI));
    }
  }

  for (let k = 0; k < 8; k++) candidateAngles.push((k * Math.PI) / 4);

  let bestCandidate = null;
  let bestScore = -Infinity;

  for (const theta of candidateAngles) {
    const cos = Math.cos(theta), sin = Math.sin(theta);
    let anchor = 'middle', textX = p.x;
    if (cos > 0.35) { anchor = 'start'; textX = p.x + 8; }
    else if (cos < -0.35) { anchor = 'end'; textX = p.x - 8; }

    let baseline = 'central', textY = p.y;
    if (sin > 0.35) { baseline = 'hanging'; textY = p.y + 8; }
    else if (sin < -0.35) { baseline = 'auto'; textY = p.y - 8; }

    const centerX = anchor === 'start' ? textX + 7 : anchor === 'end' ? textX - 7 : textX;
    const centerY = baseline === 'hanging' ? textY + 6 : baseline === 'auto' ? textY - 6 : textY;

    let score = 100;
    for (const a of angles) {
      const diff = Math.abs(Math.atan2(Math.sin(theta - a), Math.cos(theta - a)));
      if (diff < 0.35) score -= 5000;
      else if (diff < 0.6) score -= (0.6 - diff) * 2000;
      else score += diff * 40;
    }

    for (const s of segments) {
      const d = distToSegment(centerX, centerY, s.a.x, s.a.y, s.b.x, s.b.y);
      if (d < 8) score -= 6000;
      else if (d < 16) score -= (16 - d) * 300;
      else score += Math.min(d, 35) * 6;
    }

    for (const c of circles) {
      const dCirc = Math.abs(Math.hypot(centerX - c.center.x, centerY - c.center.y) - c.r);
      if (dCirc < 8) score -= 6000;
      else if (dCirc < 16) score -= (16 - dCirc) * 300;
      else score += Math.min(dCirc, 30) * 5;
    }

    for (const pl of placedLabels) {
      const dPl = Math.hypot(centerX - pl.x, centerY - pl.y);
      if (dPl < 20) score -= 3000;
    }

    if (centerX < 20 || centerX > 980 || centerY < 20 || centerY > 640) score -= 5000;
    score += Math.abs(Math.sin(2 * theta)) * 8;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = { x: Math.round(textX), y: Math.round(textY), anchor, baseline, centerX, centerY };
    }
  }

  return bestCandidate || { x: p.x + 12, y: p.y - 12, anchor: 'start', baseline: 'auto', centerX: p.x + 16, centerY: p.y - 12 };
}

export function renderSVG(doc,{grid=true,scale=55,selected='',pending=[],selectedIds=[]}={}){
  const {points}=resolve(doc),chosen=new Set(selectedIds),to=p=>screen(p,scale);let out=grid?'<rect width="1000" height="660" fill="url(#dots)"/>':'';
  const allSegments = [];
  const incidentMap = new Map();
  for (const p of Object.values(points)) incidentMap.set(p.id, []);

  for(const s of doc.shapes){const p=s.refs.map(r=>points[r]);if(s.visible===false||p.some(v=>!v))continue;const q=p.map(to),color=s.color||'#176b52',attrs=`stroke="${chosen.has(s.id)?'#b07519':color}" stroke-width="${s.id===selected||chosen.has(s.id)?4:2.4}" fill="none" ${s.dashed?'stroke-dasharray="8 6"':''} data-shape="${escape(s.id)}"`;
    if(['segment','line','ray','vector'].includes(s.type)){let[a,b]=q;if(Math.hypot(b.x-a.x,b.y-a.y)<1e-7)continue;if(s.type==='line'||s.type==='ray'){const dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy);if(s.type==='line')a={x:a.x-dx/n*2000,y:a.y-dy/n*2000};b={x:b.x+dx/n*2000,y:b.y+dy/n*2000};}out+=line(a,b,attrs+(s.type==='vector'?' marker-end="url(#arrow)"':''));
      allSegments.push({ a: q[0], b: q[1] });
      if (incidentMap.has(s.refs[0])) incidentMap.get(s.refs[0]).push(q[1]);
      if (incidentMap.has(s.refs[1])) incidentMap.get(s.refs[1]).push(q[0]);
      if(['tick','double','parallel'].includes(s.mark)){const mx=(q[0].x+q[1].x)/2,my=(q[0].y+q[1].y)/2,dx=q[1].x-q[0].x,dy=q[1].y-q[0].y,n=Math.hypot(dx,dy);for(const offset of s.mark==='double'?[-4,4]:[0])out+=line({x:mx+dx/n*offset-dy/n*7,y:my+dy/n*offset+dx/n*7},{x:mx+dx/n*offset+dy/n*7,y:my+dy/n*offset-dx/n*7},`stroke="${color}" stroke-width="2"`);if(s.mark==='parallel')out+=text(mx+8,my-8,'∥');}
    }else if(s.type==='polygon'){
      out+=`<polygon points="${q.map(v=>`${v.x},${v.y}`).join(' ')}" ${attrs} style="fill:${s.fill||color};fill-opacity:${s.fill?0.3:0.035}"/>`;
      for (let i = 0; i < q.length; i++) {
        const j = (i + 1) % q.length;
        allSegments.push({ a: q[i], b: q[j] });
        if (incidentMap.has(s.refs[i])) incidentMap.get(s.refs[i]).push(q[j]);
        if (incidentMap.has(s.refs[j])) incidentMap.get(s.refs[j]).push(q[i]);
      }
    }else if(s.type==='circle'){const r=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y);if(r>1e-7)out+=`<circle cx="${q[0].x}" cy="${q[0].y}" r="${r}" ${attrs}/>`;}
    else if(s.type==='length')out+=text((q[0].x+q[1].x)/2+8,(q[0].y+q[1].y)/2-12,Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y).toFixed(2),`data-shape="${escape(s.id)}" style="fill:${chosen.has(s.id)?'#b07519':color};font-weight:${chosen.has(s.id)?600:400}"`);
    else if(s.type==='vectorCoords'){out+=text((q[0].x+q[1].x)/2+8,(q[0].y+q[1].y)/2+25,`(${(p[1].x-p[0].x).toFixed(2)}; ${(p[1].y-p[0].y).toFixed(2)})`,`data-shape="${escape(s.id)}" style="fill:${chosen.has(s.id)?'#b07519':color};font-weight:${chosen.has(s.id)?600:400}"`);}
    else if(['dot','vectorAngle'].includes(s.type)){const u={x:p[1].x-p[0].x,y:p[1].y-p[0].y},v={x:p[3].x-p[2].x,y:p[3].y-p[2].y},prod=u.x*v.x+u.y*v.y,den=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);if(s.type==='dot'||den>1e-9)out+=text(q[0].x+12,q[0].y+35,s.type==='dot'?`${s.refs[0]}${s.refs[1]} · ${s.refs[2]}${s.refs[3]} = ${prod.toFixed(2)}`:`Góc vectơ = ${(Math.acos(Math.max(-1,Math.min(1,prod/den)))*180/Math.PI).toFixed(1)}°`,`data-shape="${escape(s.id)}" style="fill:${chosen.has(s.id)?'#b07519':color};font-weight:${chosen.has(s.id)?600:400}"`);}
    else if(s.type==='angle'){const[a,b,c]=q,u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y},nu=Math.hypot(u.x,u.y),nv=Math.hypot(v.x,v.y);if(nu<1e-7||nv<1e-7)continue;const dot=(u.x*v.x+u.y*v.y)/(nu*nv),angle=Math.acos(Math.max(-1,Math.min(1,dot))),r=25;if(s.mark==='right'||Math.abs(angle-Math.PI/2)<1e-3){const r2=18,p1={x:b.x+u.x/nu*r2,y:b.y+u.y/nu*r2},p2={x:b.x+(u.x/nu+v.x/nv)*r2,y:b.y+(u.y/nu+v.y/nv)*r2},p3={x:b.x+v.x/nv*r2,y:b.y+v.y/nv*r2};out+=`<path d="M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}" ${attrs}/>`;allSegments.push({a:p1,b:p2},{a:p2,b:p3});}else{const start={x:b.x+u.x/nu*r,y:b.y+u.y/nu*r},end={x:b.x+v.x/nv*r,y:b.y+v.y/nv*r};out+=`<path d="M ${start.x} ${start.y} A ${r} ${r} 0 0 ${u.x*v.y-u.y*v.x>0?1:0} ${end.x} ${end.y}" ${attrs}/>`;const midAngle=Math.atan2(u.y/nu+v.y/nv,u.x/nu+v.x/nv);out+=text(b.x+Math.cos(midAngle)*(r+16),b.y+Math.sin(midAngle)*(r+16),(angle*180/Math.PI).toFixed(0)+'°',`style="font-size:13px;fill:${chosen.has(s.id)?'#b07519':color}"`);}}
  }

  const allCircles = [];
  for (const s of doc.shapes) {
    if (s.visible === false || s.type !== 'circle') continue;
    const p = s.refs.map(r => points[r]);
    if (p.some(v => !v)) continue;
    const q = p.map(to);
    const r = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
    if (r > 1e-4) allCircles.push({ center: q[0], r });
  }

  const placedLabels = [];
  for(const p of Object.values(points)){
    if(p.visible===false)continue;
    const q=to(p),isSelected=p.id===selected||chosen.has(p.id)||pending.includes(p.id);
    let labelSVG = '';
    if(p.labelVisible!==false){
      const placement = computeLabelPlacement(q, incidentMap.get(p.id) || [], allSegments, allCircles, placedLabels, p.id);
      placedLabels.push({ x: placement.centerX, y: placement.centerY });
      labelSVG = text(placement.x, placement.y, p.label||p.id, `class="label" text-anchor="${placement.anchor}" dominant-baseline="${placement.baseline}" pointer-events="none"`);
    }
    out+=`<g class="point" tabindex="0" role="button" aria-label="Điểm ${escape(p.label||p.id)}" data-point="${escape(p.id)}"><circle cx="${q.x}" cy="${q.y}" r="20" fill="transparent"/><circle cx="${q.x}" cy="${q.y}" r="${isSelected?7:5.5}" fill="${p.kind?'#dfac48':'#176b52'}" stroke="${isSelected?'#b07519':'#fff'}" stroke-width="2"/>${labelSVG}</g>`;
  }
  return wrapper(out);
}
export function graphPaths(expression,params,scale=55){const fn=compileExpressionP(expression),paths=[];let current='',previous=null;const xmin=-W/(2*scale),xmax=-xmin;
  // ponytail: bounded sampling, not a symbolic singularity detector. Subdivide adaptively for fine export in a future version.
  for(let i=0;i<=1000;i++){const x=xmin+(xmax-xmin)*i/1000,y=fn(x,params),q=screen({x,y},scale);const valid=Number.isFinite(y)&&Math.abs(q.y)<H*3;if(!valid||(previous&&Math.abs(q.y-previous.y)>H*.65)){if(current)paths.push(current);current='';previous=null;}if(valid){current+=(current?' L ':'M ')+q.x.toFixed(2)+' '+q.y.toFixed(2);previous=q;}}
  if(current)paths.push(current);return paths;
}
export function graphSVG(graph,{scale=55,grid=true}={}){if(graph.enabled===false)return wrapper(text(500,330,'Chưa có đồ thị · chọn Vẽ lại','text-anchor="middle"'));let out='';const bound=Math.ceil(W/(2*scale));if(grid)for(let i=-bound;i<=bound;i++){out+=line({x:500+i*scale,y:0},{x:500+i*scale,y:660},'stroke="#edf2ef"');out+=line({x:0,y:330+i*scale},{x:1000,y:330+i*scale},'stroke="#edf2ef"');if(i!==0){out+=text(500+i*scale+3,352,i,'style="font-size:13px"');if(Math.abs(i*scale)<310)out+=text(506,330-i*scale-3,i,'style="font-size:13px"');}}
  out+=line({x:0,y:330},{x:985,y:330},'stroke="#839b91" marker-end="url(#arrow)"')+line({x:500,y:660},{x:500,y:10},'stroke="#839b91" marker-end="url(#arrow)"');out+=text(965,355,'x')+text(515,24,'y');const pObj=Object.fromEntries(graph.params.map(p=>[p.name,p.value]));
for(const e of graph.expressions){
  if(e.visible===false)continue;
  const color = e.color || '#176b52';
  const type = detectExpressionType(e.expr);
  const norm = normalizeToLHS(e.expr);
  if (type === 'implicit') {
    const d = renderImplicitCurve(norm.lhs, pObj, scale);
    if (d) out += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3"/>';
  } else if (type === 'inequality') {
    out += renderInequality(norm.lhs, pObj, scale, norm.op, color);
    // Render boundary curve as implicit if equation is >= or <=
    if (norm.op.includes('=')) {
      const d = renderImplicitCurve(norm.lhs, pObj, scale);
      if (d) out += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3"/>';
    } else {
      // Dashed boundary for strict inequality
      const d = renderImplicitCurve(norm.lhs, pObj, scale);
      if (d) out += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-dasharray="8 6"/>';
    }
  } else {
    for(const d of graphPaths(norm.lhs, pObj, scale)) {
      out += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="3"/>';
    }
  }
}
return wrapper(out);}
export function chartSVG(chart,{grid=true}={}){if(chart.enabled===false)return wrapper(text(500,330,'Chưa có biểu đồ · chọn Vẽ lại','text-anchor="middle"'));const {labels,values,type}=chart,colors=['#176b52','#dca544','#6f9e8f','#4f7eb1','#b97563','#9b8cb5'];let out='';if(type==='pie'){const total=values.reduce((a,b)=>a+b,0);let angle=-Math.PI/2;values.forEach((v,i)=>{const sweep=v/total*2*Math.PI,next=angle+sweep;if(v===total)out+='<circle cx="380" cy="330" r="210" fill="#176b52"/>';else if(v>0)out+=`<path d="M 380 330 L ${380+210*Math.cos(angle)} ${330+210*Math.sin(angle)} A 210 210 0 ${sweep>Math.PI?1:0} 1 ${380+210*Math.cos(next)} ${330+210*Math.sin(next)} Z" fill="${colors[i%colors.length]}" stroke="white" stroke-width="3"/>`;out+=`<rect x="${610+Math.floor(i/20)*190}" y="${100+(i%20)*25}" width="12" height="12" fill="${colors[i%colors.length]}"/>`+text(628+Math.floor(i/20)*190,111+(i%20)*25,labels[i]+': '+(v/total*100).toFixed(1)+'%',`style="font-size:11px" textLength="${Math.min(166,(labels[i].length+9)*5.5)}" lengthAdjust="spacingAndGlyphs"`);angle=next;});}
  else{const second=type==='double'?chart.second:[],max=Math.max(1,...values,...second),width=840/values.length,bottom=550;for(let i=0;i<=5;i++){const y=bottom-i*90;out+=(grid||i===0?line({x:90,y},{x:950,y},'stroke="#e3eae6"'):'')+text(20,y+5,(max*i/5).toFixed(1));}let path='';values.forEach((v,i)=>{const x=100+i*width,y=bottom-v/max*450;if(type==='line'){path+=(i?' L ':'M ')+(x+width/2)+' '+y;out+=`<circle cx="${x+width/2}" cy="${y}" r="5" fill="#176b52"/>`;}else{const bw=type==='double'?width*.35:type==='histogram'?width:width*.65;out+=`<rect x="${x+(type==='histogram'?0:width*.08)}" y="${y}" width="${bw}" height="${bottom-y}" rx="${type==='histogram'?0:4}" fill="#176b52"/>`;if(type==='double')out+=`<rect x="${x+width*.48}" y="${bottom-second[i]/max*450}" width="${bw}" height="${second[i]/max*450}" rx="4" fill="#dfac48"/>`;}const label=type==='histogram'?`${chart.start+i*chart.width}–${chart.start+(i+1)*chart.width}`:labels[i];out+=text(x+width/2,580,label,'text-anchor="middle" style="font-size:15px"');});if(path)out+=`<path d="${path}" fill="none" stroke="#176b52" stroke-width="3"/>`;if(type==='double')out+=text(110,50,'● Dãy 1   ● Dãy 2 (vàng)');}return wrapper(out);}
export const solidNames={box:'Hình hộp chữ nhật',cube:'Lập phương',pyramid:'Chóp đáy đều',prism:'Lăng trụ đáy đều',tetrahedron:'Tứ diện đều',cylinder:'Hình trụ',cone:'Hình nón',sphere:'Hình cầu',custom:'Không gian 3D tự do','sa-perp-pyramid':'Chóp SA ⊥ đáy','trapezoid-pyramid':'Chóp đáy hình thang','prism4':'Lăng trụ tứ giác'};
const sphereCurves=[...[-60,-30,0,30,60].map(latitude=>{
  const a=latitude*Math.PI/180;return Array.from({length:97},(_,i)=>{const t=i*2*Math.PI/96;return[2*Math.cos(a)*Math.cos(t),2*Math.sin(a),2*Math.cos(a)*Math.sin(t)];});
}),...Array.from({length:6},(_,j)=>{const t=j*Math.PI/6;return Array.from({length:97},(_,i)=>{const a=i*2*Math.PI/96;return[2*Math.cos(a)*Math.cos(t),2*Math.sin(a),2*Math.cos(a)*Math.sin(t)];});})];
export function solidSVG(solid,{selectedFace=null}={}){
  if(solid.enabled===false)return wrapper(text(500,330,'Chưa có khối hình · chọn Vẽ lại','text-anchor="middle"'));
  const rad=(solid.rotation??30)*Math.PI/180,tilt=(solid.tilt??20)*Math.PI/180;
  const cr=Math.cos(rad),sr=Math.sin(rad),ct=Math.cos(tilt),st=Math.sin(tilt);
  const rotate=([x,y,z])=>{const xx=x*cr+z*sr,zz=-x*sr+z*cr;return[xx,y*ct-zz*st,y*st+zz*ct];};
  const camera={rotation:solid.rotation??30,tilt:solid.tilt??20};
  let out='<rect width="1000" height="660" fill="url(#dots)"/>'+text(30,40,solidNames[solid.type]||solid.type||'Hình học không gian');

  if(solid.type==='sphere'){
    const paths=['',''],xy=p=>`${(500+p[0]*90).toFixed(2)} ${(330-p[1]*90).toFixed(2)}`;
    for(const curve of sphereCurves){const points=curve.map(rotate);let previous=-1;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],front=Number(a[2]+b[2]>0);paths[front]+=(front===previous?' L ':' M '+xy(a)+' L ')+xy(b);previous=front;}}
    for(const front of [0,1])out+=`<path data-sphere-depth="${front?'front':'back'}" d="${paths[front]}" fill="none" stroke="${front?'#176b52':'#a4bfb0'}" stroke-width="${front?1.8:1}" ${front?'':'stroke-dasharray="4 5"'}/>`;
    out+='<path data-center-leader="true" d="M 500 330 L 709 348" stroke="#8bada0" stroke-width="1" fill="none"/>'+text(715,350,'O');return wrapper('<g data-solid="sphere">'+out+'</g>');
  }

  // Handle explicit 3D points & segments
  if(Array.isArray(solid.points)){
    const ptsMap={},ptsScreen={},ptsProj={};
    for(const p of solid.points){
      if(p.visible===false)continue;
      const pt3d={x:p.x??0,y:p.y??0,z:p.z??0};
      ptsMap[p.id]=pt3d;
      ptsProj[p.id]=project3D(pt3d,camera);
      ptsScreen[p.id]=screen3D(pt3d,camera);
    }

    let faces=[];
    if(solid.type&&solid.type!=='custom'){
      const std=getStandardSolidGeometry(solid.type,solid.sides);
      faces=std.faces.filter(f=>f.verts.every(vid=>ptsMap[vid]));
    }
    const orientedFaces=orientPolyhedronFaces(
      faces.map(f=>({
        ...f,
        verts:f.verts.map(vid=>ptsMap[vid]).filter(Boolean)
      })),
      ptsMap
    );
    const polyOcclusion=evaluatePolyhedronEdges(orientedFaces,camera);

    // Cross sections
    if(Array.isArray(solid.crossSections)){
      for(const cs of solid.crossSections){
        if(cs.visible===false)continue;
        const refs=cs.planeRefs||cs.refs;
        if(refs&&refs.length>=3&&refs.every(r=>ptsScreen[r])){
          const color=cs.color||'#176b52';
          const opacity=cs.opacity??0.15;
          const polyPts=refs.map(r=>`${ptsScreen[r].x.toFixed(1)},${ptsScreen[r].y.toFixed(1)}`).join(' ');
          out+=`<polygon points="${polyPts}" fill="${escape(color)}" fill-opacity="${opacity}" stroke="${escape(color)}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
        }
      }
    }

    // Segments
    const segsToDraw=[];
    if(Array.isArray(solid.segments)&&solid.segments.length>0){
      for(const s of solid.segments){
        if(s.visible===false||!s.refs||s.refs.length<2)continue;
        const[a,b]=s.refs;
        if(!ptsScreen[a]||!ptsScreen[b])continue;
        segsToDraw.push({
          id:s.id,
          a,
          b,
          color:s.color,
          strokeWidth:s.strokeWidth,
          styleMode:s.styleMode??'auto'
        });
      }
    }

    const canvasSegments=[];
    const solidNeighbors=new Map();
    for(const id of Object.keys(ptsScreen))solidNeighbors.set(id,[]);

    const dashedLines=[];
    const solidLines=[];

    for(const seg of segsToDraw){
      const pa=ptsScreen[seg.a],pb=ptsScreen[seg.b];
      canvasSegments.push({a:pa,b:pb});
      solidNeighbors.get(seg.a)?.push(pb);
      solidNeighbors.get(seg.b)?.push(pa);

      const key=edgeKey(seg.a,seg.b);
      let isOccluded=false;
      if(polyOcclusion.edgeVisibility.has(key)){
        isOccluded=!polyOcclusion.edgeVisibility.get(key);
      }else if(orientedFaces.length>0){
        isOccluded=evaluateSegmentOcclusion(ptsMap[seg.a],ptsMap[seg.b],orientedFaces,camera);
      }

      const dashed=resolveSegmentDashed(seg,isOccluded);
      if(dashed){
        dashedLines.push(seg);
      }else{
        solidLines.push(seg);
      }
    }

    // Render dashed segments
    for(const s of dashedLines){
      const pa=ptsScreen[s.a],pb=ptsScreen[s.b];
      const color=s.color||'#8bada0';
      const width=s.strokeWidth||2.5;
      out+=line(pa,pb,`stroke="${escape(color)}" stroke-width="${width}" stroke-dasharray="8 7"`);
    }

    // Render solid segments
    for(const s of solidLines){
      const pa=ptsScreen[s.a],pb=ptsScreen[s.b];
      const color=s.color||'#176b52';
      const width=s.strokeWidth||2.5;
      out+=line(pa,pb,`stroke="${escape(color)}" stroke-width="${width}"`);
    }

    // Render vertices and smart labels
    const labelPositions=[];
    for(const[id,p]of Object.entries(ptsScreen)){
      const origP=solid.points.find(pt=>pt.id===id);
      const label=origP?.label||id;
      const isApex=id==='S'||label==='S';
      const placement=computeLabelPlacement3D(
        p,
        solidNeighbors.get(id)||[],
        canvasSegments,
        labelPositions,
        {label,isApex}
      );
      labelPositions.push({x:placement.centerX,y:placement.centerY});
      out+=`<circle data-vertex="${id}" cx="${p.x}" cy="${p.y}" r="3.5" fill="#176b52"/>`+
        text(placement.x,placement.y,label,`data-vertex-label="${id}" text-anchor="${placement.anchor}" dominant-baseline="${placement.baseline}" pointer-events="none"`);
    }

    return wrapper(`<g data-solid="${solid.type||'custom'}">${out}</g>`);
  }

  // Legacy solid generation
  let verts,faces;
  const curved=['cone','cylinder'].includes(solid.type),n=curved?48:solid.type==='tetrahedron'?3:(solid.sides??(solid.type==='prism'?3:4));
  if(['box','cube'].includes(solid.type)){
    const y=solid.type==='cube'?2:1.5,z=solid.type==='cube'?2:1.5;verts=[[-2,-y,-z],[2,-y,-z],[2,-y,z],[-2,-y,z],[-2,y,-z],[2,y,-z],[2,y,z],[-2,y,z]];faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  }else{
    const base=Array.from({length:n},(_,i)=>[2*Math.cos(2*Math.PI*i/n),-1.5,2*Math.sin(2*Math.PI*i/n)]);
    if(['pyramid','tetrahedron','cone'].includes(solid.type)){verts=[...base,[0,solid.type==='tetrahedron'?2*Math.sqrt(2)-1.5:2,0]];faces=[Array.from({length:n},(_,i)=>i),...Array.from({length:n},(_,i)=>[(i+1)%n,i,n])];}
    else{verts=[...base,...base.map(([x,,z])=>[x,1.5,z])];faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>2*n-1-i),...Array.from({length:n},(_,i)=>[(i+1)%n,i,n+i,n+(i+1)%n])];}
  }
  const v=verts.map(rotate),q=v.map(([x,y])=>({x:500+x*85,y:330-y*85})),edges=new Map(),edgeFaces=new Map();
  const renderedFaces=[];
  faces.forEach((face,index)=>{const[a,b,c]=face.map(i=>v[i]),u=b.map((value,i)=>value-a[i]),w=c.map((value,i)=>value-a[i]),visible=u[0]*w[1]-u[1]*w[0]>0,planar=!curved||index<(solid.type==='cone'?1:2),style=planar?solid.faceStyles?.[index]:null;
    const color=style?.color||'#176b52',opacity=style?.opacity??(visible?0.04:0),selected=planar&&index===selectedFace;
    if(planar||visible)renderedFaces.push({depth:face.reduce((sum,i)=>sum+v[i][2],0)/face.length,svg:`<polygon ${planar?`data-face="${index}"`:''} points="${face.map(i=>q[i].x+','+q[i].y).join(' ')}" fill="${escape(color)}" fill-opacity="${opacity}" ${selected?'data-selected="true" stroke="#dfac48" stroke-width="4"':''}/>`});
    face.forEach((index,j)=>{const next=face[(j+1)%face.length],key=[index,next].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||false)||visible);if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push(visible);});});
  out+=renderedFaces.sort((a,b)=>a.depth-b.depth).map(face=>face.svg).join('');
  for(const visible of [false,true])for(const[key,front]of edges)if(front===visible){const[a,b]=key.split(',').map(Number);if(curved&&a<n&&b>=n){const adjacent=edgeFaces.get(key);if(!adjacent.includes(true)||!adjacent.includes(false))continue;}out+=line(q[a],q[b],`stroke="${front?'#176b52':'#8bada0'}" stroke-width="${curved?1.8:2.5}" ${front?'':'stroke-dasharray="8 7"'}`);}
  const solidSegments = [];
  const solidNeighbors = new Map();
  for (let i = 0; i < q.length; i++) solidNeighbors.set(i, []);
  for (const [key] of edges) {
    const [a, b] = key.split(',').map(Number);
    solidSegments.push({ a: q[a], b: q[b] });
    if (solidNeighbors.has(a)) solidNeighbors.get(a).push(q[b]);
    if (solidNeighbors.has(b)) solidNeighbors.get(b).push(q[a]);
  }
  const labelPositions = [];
  q.forEach((p,i)=>{
    if(curved&&i%12!==0&&i!==n)return;
    const label=curved?(solid.type==='cone'&&i===n?'S':i<n?String.fromCharCode(65+i/12):String.fromCharCode(65+(i-n)/12)+'′'):i<26?String.fromCharCode(65+i):'V'+(i+1);
    const placement = computeLabelPlacement(p, solidNeighbors.get(i) || [], solidSegments, [], labelPositions, i);
    labelPositions.push({ x: placement.centerX, y: placement.centerY });
    out+=`<circle data-vertex="${i}" cx="${p.x}" cy="${p.y}" r="3.5" fill="#176b52"/>`+text(placement.x, placement.y, label, `data-vertex-label="${i}" text-anchor="${placement.anchor}" dominant-baseline="${placement.baseline}" pointer-events="none"`);
  });
  return wrapper(`<g data-solid="${solid.type}">${out}</g>`);
}


export function renderImplicitCurve(expr, params, scale) {
  const segments = sampleImplicit(expr, params, { xmin: -1000/(2*scale), xmax: 1000/(2*scale), ymin: -660/(2*scale), ymax: 660/(2*scale) });
  let paths = '';
  for (const seg of segments) {
    const sp1 = screen({x: seg.x1, y: seg.y1}, scale);
    const sp2 = screen({x: seg.x2, y: seg.y2}, scale);
    paths += `M ${sp1.x.toFixed(1)} ${sp1.y.toFixed(1)} L ${sp2.x.toFixed(1)} ${sp2.y.toFixed(1)} `;
  }
  return paths;
}

export function sampleImplicit(expr, params, grid, res = 150) {
  const fn = compileExpressionP(expr);
  const { xmin, xmax, ymin, ymax } = grid;
  const stepX = (xmax - xmin) / res;
  const stepY = (ymax - ymin) / res;

  const vals = new Float32Array((res + 1) * (res + 1));
  for (let i = 0; i <= res; i++) {
    const y = ymax - i * stepY;
    for (let j = 0; j <= res; j++) {
      const x = xmin + j * stepX;
      const v = fn(x, { ...params, y });
      vals[i * (res + 1) + j] = Number.isFinite(v) ? v : NaN;
    }
  }

  const segments = [];
  const interp = (v1, v2) => {
    if (isNaN(v1) || isNaN(v2) || v1 === v2) return 0.5;
    return Math.max(0, Math.min(1, (0 - v1) / (v2 - v1)));
  };

  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const idx = i * (res + 1) + j;
      const tl = vals[idx], tr = vals[idx + 1];
      const bl = vals[idx + res + 1], br = vals[idx + res + 2];
      if (isNaN(tl) || isNaN(tr) || isNaN(bl) || isNaN(br)) continue;

      let caseIdx = 0;
      if (tl > 0) caseIdx |= 8;
      if (tr > 0) caseIdx |= 4;
      if (br > 0) caseIdx |= 2;
      if (bl > 0) caseIdx |= 1;

      if (caseIdx === 0 || caseIdx === 15) continue;

      const pTop = caseIdx & 12 && (caseIdx & 12) !== 12 ? { gx: j + interp(tl, tr), gy: i } : null;
      const pBot = caseIdx & 3 && (caseIdx & 3) !== 3 ? { gx: j + interp(bl, br), gy: i + 1 } : null;
      const pLeft = caseIdx & 9 && (caseIdx & 9) !== 9 ? { gx: j, gy: i + interp(tl, bl) } : null;
      const pRight = caseIdx & 6 && (caseIdx & 6) !== 6 ? { gx: j + 1, gy: i + interp(tr, br) } : null;

      const segs = [];
      if (caseIdx === 1 || caseIdx === 14) segs.push([pLeft, pBot]);
      else if (caseIdx === 2 || caseIdx === 13) segs.push([pBot, pRight]);
      else if (caseIdx === 4 || caseIdx === 11) segs.push([pTop, pRight]);
      else if (caseIdx === 8 || caseIdx === 7) segs.push([pLeft, pTop]);
      else if (caseIdx === 3 || caseIdx === 12) segs.push([pLeft, pRight]);
      else if (caseIdx === 6 || caseIdx === 9) segs.push([pTop, pBot]);
      else if (caseIdx === 5) { segs.push([pLeft, pTop]); segs.push([pBot, pRight]); }
      else if (caseIdx === 10) { segs.push([pTop, pRight]); segs.push([pLeft, pBot]); }

      for (const [p1, p2] of segs) {
        if (!p1 || !p2) continue;
        segments.push({
          x1: xmin + p1.gx * stepX, y1: ymax - p1.gy * stepY,
          x2: xmin + p2.gx * stepX, y2: ymax - p2.gy * stepY
        });
      }
    }
  }
  return segments;
}

export function renderInequality(expr, params, scale, op, color) {
  const fn = compileExpressionP(expr);
  const W = 1000, H = 660;
  const res = 100;
  const xmin = -W / (2 * scale);
  const xmax = -xmin;
  const ymax = H / (2 * scale);
  const ymin = -ymax;
  const stepX = (xmax - xmin) / res;
  const stepY = (ymax - ymin) / res;
  
  let paths = '';
  for (let i = 0; i < res; i++) {
    const y = ymax - (i + 0.5) * stepY;
    let inRegion = false;
    let startX = null;
    
    for (let j = 0; j <= res; j++) {
      const x = xmin + j * stepX;
      const v = fn(x, { ...params, y });
      
      const match = op.includes('<') ? v < 0 : v > 0;
      
      if (match && !inRegion) {
        inRegion = true;
        startX = x;
      } else if (!match && inRegion) {
        inRegion = false;
        const p1 = screen({x: startX, y: ymax - i * stepY}, scale);
        const p2 = screen({x: x, y: ymax - (i + 1) * stepY}, scale);
        paths += `<rect x="${p1.x}" y="${p1.y}" width="${p2.x - p1.x}" height="${p2.y - p1.y}" fill="${color}" fill-opacity="0.2"/>`;
      }
    }
    if (inRegion) {
      const p1 = screen({x: startX, y: ymax - i * stepY}, scale);
      const p2 = screen({x: xmax, y: ymax - (i + 1) * stepY}, scale);
      paths += `<rect x="${p1.x}" y="${p1.y}" width="${p2.x - p1.x}" height="${p2.y - p1.y}" fill="${color}" fill-opacity="0.2"/>`;
    }
  }
  return paths;
}

export function exportSVG(doc,mode,{scale=55,pan={x:0,y:0},viewport=null}={}){
 const options={grid:false,scale};let svg;
 if(mode!=='geometry'&&doc[mode]?.enabled===false)svg=wrapper('');
 else if(mode==='geometry')svg=renderSVG(doc,options).replace('viewBox="0 0 1000 660"','viewBox="'+(viewport?`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`:`${pan.x} ${pan.y} 1000 660`)+'"');
 else if(mode==='graph')svg=graphSVG(doc.graph,options);else if(mode==='chart')svg=chartSVG(doc.chart,options);else if(mode==='solid')svg=solidSVG(doc.solid);else throw Error('Chế độ xuất không hợp lệ');
 return svg.replace(/<rect width="1000" height="660" fill="(?:#ffffff|url\(#dots\))"\/>/g,'').replace(/<pattern id="dots"[\s\S]*?<\/pattern>/g,'');
}

export function renderSnapOverlay(snapInfo, scale = 55, pan = { x: 0, y: 0 }) {
  if (!snapInfo) return '';
  const toScreen = (x, y) => ({
    cx: 500 + x * scale - pan.x,
    cy: 330 - y * scale - pan.y
  });

  let out = '<g data-snap-overlay="true" pointer-events="none">';

  // 1. Target Indicator
  if (snapInfo.snapTarget?.type) {
    const { cx, cy } = toScreen(snapInfo.snapTarget.x, snapInfo.snapTarget.y);
    if (snapInfo.snapTarget.type === 'point') {
      out += `<circle cx="${cx}" cy="${cy}" r="14" fill="rgba(255, 204, 0, 0.25)" stroke="#ffcc00" stroke-width="2" stroke-dasharray="3 3"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="4" fill="#ffcc00"/>`;
    } else if (snapInfo.snapTarget.type === 'midpoint') {
      out += `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="rgba(42, 157, 143, 0.3)" stroke="#2a9d8f" stroke-width="2" transform="rotate(45 ${cx} ${cy})"/>`;
    } else if (snapInfo.snapTarget.type === 'grid') {
      out += `<path d="M ${cx - 7} ${cy} L ${cx + 7} ${cy} M ${cx} ${cy - 7} L ${cx} ${cy + 7}" stroke="#176b52" stroke-width="1.8"/>`;
    }
  }

  // 2. Angular Snap & Length HUD
  if (snapInfo.angularSnap && snapInfo.cursor) {
    const { cx, cy } = toScreen(snapInfo.cursor.x, snapInfo.cursor.y);
    const { angleDeg, length, isRightAngle, snapped } = snapInfo.angularSnap;
    const angleText = isRightAngle ? '90° ⊥' : `${angleDeg.toFixed(1)}°`;
    const label = `∠ ${angleText} · L: ${length.toFixed(2)}`;
    const badgeColor = snapped ? '#176b52' : '#334155';
    const boxWidth = Math.max(100, label.length * 7.5 + 16);

    out += `<g transform="translate(${cx + 14}, ${cy - 14})">
      <rect x="0" y="-18" width="${boxWidth}" height="24" rx="4" fill="${badgeColor}" fill-opacity="0.9"/>
      <text x="8" y="-2" fill="#ffffff" font-size="11" font-family="sans-serif" font-weight="600">${label}</text>
    </g>`;
  }

  out += '</g>';
  return out;
}

