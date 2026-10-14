import {compileExpression,compileExpressionP,evaluateExpression,normalizeToLHS} from './expression.js';
const EPS=1e-9;
export const counts={midpoint:2,foot:[3,4],ratio:2,centroid:3,planeLineIntersection:5,parallel:3,perpendicular:3,equal:3,onLine:2,onCircle:2,intersection:4,lineCircle:4,circleCircle:4,bisector:3,vectorSum:4,vectorDifference:4,vectorScale:3,affine:2,rotate:2,circumcenter:3,incenter:3,tangent:3,reflectAxis:3,reflectCenter:2,translate:1,rotateAround:2,scaleFrom:2};
export const shapes={segment:[2,2],line:[2,2],ray:[2,2],vector:[2,2],circle:[2,2],polygon:[3,30],angle:[3,3],length:[2,2],dot:[4,4],vectorAngle:[4,4],vectorCoords:[2,2]};
export const emptyDocument=()=>({version:1,title:'Khám phá tam giác',points:[],shapes:[],graph:{expressions:[{id:'g1',expr:'a*x^2',color:'#e63946',visible:true}],params:[{name:'a',value:1,min:-5,max:5}]},chart:{type:'bar',labels:['A','B','C','D'],values:[4,7,5,9],second:[6,3,8,5]},solid:{type:'pyramid',rotation:30,tilt:20}});
export function blankDocument(){const d=emptyDocument();d.title='Bảng trắng';for(const key of ['graph','chart','solid'])d[key].enabled=false;return d;}
export function removeSelection(doc,ids){const chosen=new Set(ids);let next=structuredClone(doc);for(const p of doc.points)if(chosen.has(p.id))next=removePoint(next,p.id);if(doc.solid?.points)for(const p of doc.solid.points)if(chosen.has(p.id))next=removePoint(next,p.id);next.shapes=next.shapes.filter(s=>!chosen.has(s.id));if(next.solid?.segments)next.solid.segments=next.solid.segments.filter(s=>!chosen.has(s.id));return next;}
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6;
export function validateDocument(value){
  if(!value||value.version!==1||!Array.isArray(value.points)||!Array.isArray(value.shapes)||value.points.length>300||value.shapes.length>500)throw Error('Tài liệu version 1, tối đa 300 điểm / 500 đối tượng');
  const d=structuredClone(value),ids=new Set(),seen=new Set();
  for(const key of ['graph','chart','solid'])if(d[key]?.enabled!==undefined&&typeof d[key].enabled!=='boolean')throw Error('Trạng thái hiển thị phải là boolean');
  if(typeof d.title!=='string'||d.title.length>160)throw Error('Tên tài liệu không hợp lệ');
  const validatePoint=p=>{
    if(!p||typeof p.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(p.id)||ids.has(p.id))throw Error('ID điểm trùng hoặc không hợp lệ');ids.add(p.id);
    if(p.label!==undefined&&(typeof p.label!=='string'||p.label.length>80))throw Error('Nhãn quá dài');
    for(const key of ['visible','labelVisible'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('Trạng thái điểm/nhãn phải là boolean');
    if(p.z!==undefined&&!finite(p.z))throw Error('Tọa độ z không hợp lệ');
    if(p.kind&&p.kind!=='free'&&p.kind!=='preset'){
      if(!Object.hasOwn(counts,p.kind)||!Array.isArray(p.refs))throw Error('Quan hệ không hợp lệ');
      const expected=counts[p.kind];
      const match=Array.isArray(expected)?expected.includes(p.refs.length):p.refs.length===expected;
      if(!match)throw Error('Quan hệ không hợp lệ');
    }else{
      if(!finite(p.x)||!finite(p.y))throw Error('Tọa độ phải là số hữu hạn');
    }
    for(const k of ['t','angle','u','v','factor','dx','dy','dz'])if(p[k]!==undefined&&!finite(p[k]))throw Error('Tham số không hợp lệ');
    if(p.branch!==undefined&&p.branch!==1&&p.branch!==-1)throw Error('Nhánh giao phải 1 hoặc -1');
  };
  for(const p of d.points)validatePoint(p);
  if(d.solid?.points){
    if(!Array.isArray(d.solid.points)||d.solid.points.length>300)throw Error('Điểm không gian không hợp lệ');
    for(const p of d.solid.points)validatePoint(p);
  }
  const allPoints=[...d.points,...(d.solid?.points||[])];
  const byId=new Map(allPoints.map(p=>[p.id,p]));const active=new Set();
  function visit(id){if(seen.has(id))return;if(active.has(id))throw Error('Có chu trình phụ thuộc');const p=byId.get(id);if(!p)throw Error('Tham chiếu điểm không tồn tại: '+id);active.add(id);for(const r of p.refs||[])visit(r);active.delete(id);seen.add(id);}
  for(const p of allPoints)visit(p.id);
  for(const s of d.shapes){if(!s||!Object.hasOwn(shapes,s.type)||typeof s.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(s.id)||ids.has(s.id))throw Error('Đối tượng trùng hoặc không hợp lệ');const range=shapes[s.type];ids.add(s.id);if(!Array.isArray(s.refs)||s.refs.length<range[0]||s.refs.length>range[1]||s.refs.some(r=>!byId.has(r)))throw Error('Tham chiếu đối tượng không hợp lệ');if(s.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.color))throw Error('Màu không hợp lệ');if(s.dashed!==undefined&&typeof s.dashed!=='boolean')throw Error('Kiểu nét không hợp lệ');if(s.mark!==undefined&&!['none','tick','double','parallel','right'].includes(s.mark))throw Error('Ký hiệu không hợp lệ');}
  d.graph??=emptyDocument().graph;
  if(typeof d.graph.expression==='string'&&!Array.isArray(d.graph.expressions)){const colors=['#e63946','#2a9d8f','#e9c46a','#f4a261','#264653','#6d6875'];d.graph.expressions=[{id:'g1',expr:d.graph.expression,color:colors[0],visible:true}];d.graph.params=typeof d.graph.a==='number'&&Number.isFinite(d.graph.a)?[{name:'a',value:d.graph.a,min:-5,max:5}]:[];delete d.graph.expression;delete d.graph.a;}
  if(!Array.isArray(d.graph.expressions)||!Array.isArray(d.graph.params))throw Error('Sơ đồ đồ thị không hợp lệ');
  for(const e of d.graph.expressions){if(!e.id||typeof e.expr!=='string'||(e.expr.match(/[<>]=?|=/g)||[]).length>1)throw Error('Hàm số không hợp lệ');compileExpressionP(normalizeToLHS(e.expr).lhs);}
  for(const p of d.graph.params){if(!p.name||!Number.isFinite(p.value))throw Error('Tham số không hợp lệ');}
  d.chart??=emptyDocument().chart;const c=d.chart;
  if(!['bar','double','line','pie','histogram'].includes(c.type)||!Array.isArray(c.labels)||!Array.isArray(c.values)||c.labels.length!==c.values.length||!c.values.length||c.values.length>40||c.values.some(v=>!finite(v)||v<0)||c.labels.some(v=>typeof v!=='string'||v.length>40))throw Error('Dữ liệu biểu đồ: 1–40 nhãn, giá trị không âm');
  if(c.type==='pie'&&c.values.every(v=>v===0))throw Error('Biểu đồ quạt cần tổng > 0');
  if(c.type==='double'&&(!Array.isArray(c.second)||c.second.length!==c.values.length||c.second.some(v=>!finite(v)||v<0)))throw Error('Cột kép cần dãy thứ hai cùng số lượng');
  if(c.type==='histogram'&&(!finite(c.start)||!finite(c.width)||c.width<=0))throw Error('Histogram cần đầu khoảng và độ rộng > 0');
  d.solid??=emptyDocument().solid;if(!['box','cube','pyramid','prism','tetrahedron','cylinder','cone','sphere','custom'].includes(d.solid.type)||!finite(d.solid.rotation)||!finite(d.solid.tilt)||(d.solid.sides!==undefined&&(!Number.isInteger(d.solid.sides)||d.solid.sides<3||d.solid.sides>12)))throw Error('Mô hình không gian không hợp lệ');
  const solid=d.solid;
  const faceCount=solid.type==='sphere'?0:solid.type==='cone'?1:solid.type==='cylinder'?2:['box','cube'].includes(solid.type)?6:solid.type==='tetrahedron'?4:solid.type==='custom'?0:(solid.sides??(solid.type==='prism'?3:4))+(solid.type==='prism'?2:1);
  if(solid.faceStyles!==undefined){
    if(!solid.faceStyles||typeof solid.faceStyles!=='object'||Array.isArray(solid.faceStyles))throw Error('Màu mặt không hợp lệ');
    for(const [index,style] of Object.entries(solid.faceStyles))if(!/^(0|[1-9]\d*)$/.test(index)||(faceCount>0&&Number(index)>=faceCount)||!style||!/^#[0-9a-f]{6}$/i.test(style.color)||!Number.isFinite(style.opacity)||style.opacity<0||style.opacity>1)throw Error('Mặt cần tồn tại, màu #rrggbb và độ đậm từ 0 đến 1');
  }
  if(solid.segments!==undefined){
    if(!Array.isArray(solid.segments)||solid.segments.length>500)throw Error('Danh sách đoạn thẳng không gian không hợp lệ');
    for(const s of solid.segments){
      if(!s||typeof s.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(s.id)||ids.has(s.id))throw Error('ID đối tượng 3D trùng hoặc không hợp lệ');
      ids.add(s.id);
      if(!Array.isArray(s.refs)||s.refs.length!==2||s.refs.some(r=>!byId.has(r)))throw Error('Tham chiếu đoạn thẳng 3D không hợp lệ');
      const styleMode=s.styleMode??s.style;
      if(styleMode!==undefined&&!['auto','solid','dashed'].includes(styleMode))throw Error('Chế độ nét không hợp lệ');
      if(s.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.color))throw Error('Màu không hợp lệ');
      if(s.strokeWidth!==undefined&&(!finite(s.strokeWidth)||s.strokeWidth<=0))throw Error('Độ dày nét không hợp lệ');
      if(s.visible!==undefined&&typeof s.visible!=='boolean')throw Error('Trạng thái hiển thị phải là boolean');
    }
  }
  if(solid.planes!==undefined){
    if(!Array.isArray(solid.planes)||solid.planes.length>100)throw Error('Danh sách mặt phẳng 3D không hợp lệ');
    for(const pl of solid.planes){
      if(!pl||typeof pl.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(pl.id)||ids.has(pl.id))throw Error('ID mặt phẳng 3D trùng hoặc không hợp lệ');
      ids.add(pl.id);
      if(!Array.isArray(pl.refs)||pl.refs.length!==3||pl.refs.some(r=>!byId.has(r)))throw Error('Tham chiếu mặt phẳng 3D không hợp lệ');
      if(pl.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(pl.color))throw Error('Màu không hợp lệ');
      if(pl.opacity!==undefined&&(!finite(pl.opacity)||pl.opacity<0||pl.opacity>1))throw Error('Độ mờ mặt phẳng không hợp lệ');
      if(pl.visible!==undefined&&typeof pl.visible!=='boolean')throw Error('Trạng thái hiển thị phải là boolean');
    }
  }
  if(solid.crossSections!==undefined){
    if(!Array.isArray(solid.crossSections)||solid.crossSections.length>100)throw Error('Danh sách thiết diện 3D không hợp lệ');
    for(const cs of solid.crossSections){
      if(!cs||typeof cs.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(cs.id)||ids.has(cs.id))throw Error('ID thiết diện 3D trùng hoặc không hợp lệ');
      ids.add(cs.id);
      const refs=cs.planeRefs??cs.refs;
      if(!Array.isArray(refs)||refs.length!==3||refs.some(r=>!byId.has(r)))throw Error('Tham chiếu thiết diện 3D không hợp lệ');
      if(cs.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(cs.color))throw Error('Màu không hợp lệ');
      if(cs.opacity!==undefined&&(!finite(cs.opacity)||cs.opacity<0||cs.opacity>1))throw Error('Độ mờ thiết diện không hợp lệ');
      if(cs.visible!==undefined&&typeof cs.visible!=='boolean')throw Error('Trạng thái hiển thị phải là boolean');
    }
  }
  return d;
}
export const sub=(a,b)=>{const res={x:a.x-b.x,y:a.y-b.y};if(a.z!==undefined||b.z!==undefined)res.z=(a.z??0)-(b.z??0);return res;};
export const add=(a,b)=>{const res={x:a.x+b.x,y:a.y+b.y};if(a.z!==undefined||b.z!==undefined)res.z=(a.z??0)+(b.z??0);return res;};
export const mul=(a,n)=>{const res={x:a.x*n,y:a.y*n};if(a.z!==undefined)res.z=a.z*n;return res;};
export const dot=(a,b)=>{let d=a.x*b.x+a.y*b.y;if(a.z!==undefined||b.z!==undefined)d+=(a.z??0)*(b.z??0);return d;};
export const cross3D=(a,b)=>{const az=a.z??0,bz=b.z??0;return{x:a.y*bz-az*b.y,y:az*b.x-a.x*bz,z:a.x*b.y-a.y*b.x};};
export const cross=(a,b)=>{if(a.z!==undefined||b.z!==undefined)return cross3D(a,b);return a.x*b.y-a.y*b.x;};
export const norm3D=a=>Math.hypot(a.x,a.y,a.z??0);
export const norm=a=>(a.z!==undefined?norm3D(a):Math.hypot(a.x,a.y));
export const unit=a=>{const n=norm(a);if(n<EPS)throw Error('Đường/đoạn có hai điểm trùng nhau');return mul(a,1/n);};
export function construct(p,q){const[a,b,c,d,e]=q;const branch=p.branch??1;
  switch(p.kind){
    case 'reflectAxis': {
      const v = sub(c, b);
      unit(v);
      const foot = add(b, mul(v, dot(sub(a, b), v) / dot(v, v)));
      return sub(mul(foot, 2), a);
    }
    case 'reflectCenter':
      return sub(mul(b, 2), a);
    case 'translate':
      return add(a, { x: p.dx || 0, y: p.dy || 0, ...(p.dz !== undefined ? { z: p.dz } : (a.z !== undefined ? { z: 0 } : {})) });
    case 'rotateAround': {
      const angle = p.angle || 0;
      const v = sub(a, b);
      return add(b, {
        x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
        y: v.x * Math.sin(angle) + v.y * Math.cos(angle)
      });
    }
    case 'scaleFrom':
      return add(b, mul(sub(a, b), p.factor !== undefined ? p.factor : 1));
    case 'midpoint':
      return mul(add(a,b),.5);
    case 'ratio': {
      const t = p.t !== undefined ? p.t : 0.5;
      return add(a, mul(sub(b, a), t));
    }
    case 'centroid':
      return mul(add(add(a, b), c), 1 / 3);
    case 'foot': {
      if (q.length === 4) {
        const u = sub(c, b);
        const v = sub(d, b);
        const n = (a.z !== undefined || b.z !== undefined || c.z !== undefined || d.z !== undefined)
          ? cross3D(u, v)
          : { x: 0, y: 0, z: cross(u, v) };
        const nLenSq = dot(n, n);
        if (nLenSq < EPS) throw Error('Ba điểm mặt phẳng thẳng hàng / trùng nhau');
        const diff = sub(a, b);
        const dist = dot(diff, n) / nLenSq;
        return sub(a, mul(n, dist));
      } else {
        const v = sub(c, b);
        unit(v);
        return add(b, mul(v, dot(sub(a, b), v) / dot(v, v)));
      }
    }
    case 'planeLineIntersection': {
      const u = sub(b, a);
      const v = sub(c, a);
      const n = (a.z !== undefined || b.z !== undefined || c.z !== undefined)
        ? cross3D(u, v)
        : { x: 0, y: 0, z: cross(u, v) };
      const nLenSq = dot(n, n);
      if (nLenSq < EPS) throw Error('Ba điểm mặt phẳng thẳng hàng / trùng nhau');
      const lineDir = sub(e, d);
      const den = dot(n, lineDir);
      if (Math.abs(den) < EPS) throw Error('Đường thẳng song song hoặc nằm trên mặt phẳng');
      const t = dot(n, sub(a, d)) / den;
      return add(d, mul(lineDir, t));
    }
    case 'parallel':{const v=sub(c,b);unit(v);return add(a,v);}
    case 'perpendicular':{const v=sub(c,b);unit(v);return add(a,{x:-v.y,y:v.x});}
    case 'equal':{const n=norm(sub(c,b));if(n<EPS)throw Error('Độ dài tham chiếu bằng 0');return add(a,{x:n*Math.cos(p.angle??0),y:n*Math.sin(p.angle??0)});}
    case 'onLine':{const v=sub(b,a);unit(v);return add(a,mul(v,p.t??.5));}
    case 'onCircle':{const r=norm(sub(b,a));if(r<EPS)throw Error('Bán kính bằng 0');return add(a,{x:r*Math.cos(p.angle??0),y:r*Math.sin(p.angle??0)});}
    case 'intersection':{const v=sub(b,a),w=sub(d,c);unit(v);unit(w);const den=cross(v,w);if(Math.abs(den)<EPS)throw Error('Hai đường song song/trùng nhau');return add(a,mul(v,cross(sub(c,a),w)/den));}
    case 'lineCircle':{const v=sub(b,a),f=sub(a,c),r=norm(sub(d,c));unit(v);if(r<EPS)throw Error('Bán kính bằng 0');const A=dot(v,v),B=2*dot(f,v),C=dot(f,f)-r*r,delta=B*B-4*A*C;if(delta<-EPS)throw Error('Đường và tròn không giao');return add(a,mul(v,(-B+branch*Math.sqrt(Math.max(0,delta)))/(2*A)));}
    case 'circleCircle':{const v=sub(c,a),len=norm(v),r=norm(sub(b,a)),R=norm(sub(d,c));unit(v);if(r<EPS||R<EPS||len>r+R+EPS||len<Math.abs(r-R)-EPS)throw Error('Hai đường tròn không giao');const x=(len*len+r*r-R*R)/(2*len),h=Math.sqrt(Math.max(0,r*r-x*x)),u=unit(v);return add(a,add(mul(u,x),mul({x:-u.y,y:u.x},branch*h)));}
    case 'bisector':{const u=unit(sub(a,b)),v=unit(sub(c,b));return add(b,unit(add(u,v)));}
    case 'vectorSum':return add(a,add(sub(b,a),sub(d,c)));
    case 'vectorDifference':return add(a,sub(sub(b,a),sub(d,c)));
    case 'vectorScale':return add(a,mul(sub(c,b),p.factor??1));
    case 'affine':{const v=sub(b,a);unit(v);return add(a,add(mul(v,p.u??0),mul({x:-v.y,y:v.x},p.v??1)));}
    case 'rotate':{const v=sub(b,a);unit(v);const angle=p.angle??0;return add(a,{x:v.x*Math.cos(angle)-v.y*Math.sin(angle),y:v.x*Math.sin(angle)+v.y*Math.cos(angle)});}
    case 'circumcenter':{const u=sub(b,a),v=sub(c,a),den=2*cross(u,v);if(Math.abs(den)<EPS)throw Error('Ba đỉnh thẳng hàng / trùng nhau');const U=dot(u,u),V=dot(v,v);return add(a,{x:(v.y*U-u.y*V)/den,y:(u.x*V-v.x*U)/den});}
    case 'incenter':{if(Math.abs(cross(sub(b,a),sub(c,a)))<EPS)throw Error('Ba đỉnh thẳng hàng / trùng nhau');const A=norm(sub(b,c)),B=norm(sub(a,c)),C=norm(sub(a,b));return mul(add(add(mul(a,A),mul(b,B)),mul(c,C)),1/(A+B+C));}
    case 'tangent':{const v=sub(a,b),len=norm(v),r=norm(sub(c,b));if(r<EPS||len<=r+EPS)throw Error('Điểm ngoài phải nằm ngoài đường tròn');const u=unit(v),x=r*r/len,y=r*Math.sqrt(len*len-r*r)/len;return add(b,add(mul(u,x),mul({x:-u.y,y:u.x},branch*y)));}
    default:throw Error('Quan hệ chưa hỗ trợ');
  }
}
export function resolve(doc){
  const points=Object.create(null),solidPoints=Object.create(null),errors=[];
  const allDocPoints=[...(doc.points||[]),...(doc.solid?.points||[])];
  const byId=new Map(allDocPoints.map(p=>[p.id,p])),active=new Set(),failed=new Set();

  function get(id){
    if(points[id])return points[id];
    if(failed.has(id))throw Error('Nguồn '+id+' không xác định');
    if(active.has(id))throw Error('Chu trình');
    const p=byId.get(id);
    if(!p)throw Error('Thiếu điểm '+id);
    active.add(id);
    try{
      const isFree=!p.kind||p.kind==='free'||p.kind==='preset';
      const v=!isFree
        ? construct(p,p.refs.map(get))
        : {x:p.x,y:p.y,...(p.z!==undefined?{z:p.z}:{})};
      if(!finite(v.x)||!finite(v.y)||(v.z!==undefined&&!finite(v.z)))throw Error('Tọa độ ngoài giới hạn');
      points[id]={...p,...v};
      return points[id];
    }catch(e){
      failed.add(id);
      throw e;
    }finally{
      active.delete(id);
    }
  }

  for(const p of (doc.points||[]))try{get(p.id);}catch(e){errors.push(p.id+': '+e.message);}
  if(doc.solid?.points){
    for(const p of doc.solid.points)try{const pt=get(p.id);solidPoints[p.id]=pt;}catch(e){errors.push(p.id+': '+e.message);}
  }

  for(const s of (doc.shapes||[])){
    const p=s.refs.map(id=>points[id]);
    if(p.some(v=>!v)){errors.push(s.id+': Nguồn của đối tượng không xác định');continue;}
    const dist=(p[0].z!==undefined||p[1]?.z!==undefined)
      ? norm3D(sub(p[1],p[0]))
      : norm(sub(p[1],p[0]));
    if(['line','ray','circle','vector','segment'].includes(s.type)&&dist<EPS)errors.push(s.id+': Hai điểm trùng nhau, đối tượng suy biến');
    if(s.type==='angle'&&(norm(sub(p[0],p[1]))<EPS||norm(sub(p[2],p[1]))<EPS))errors.push(s.id+': Góc không xác định');
    if(s.type==='vectorAngle'&&(norm(sub(p[1],p[0]))<EPS||norm(sub(p[3],p[2]))<EPS))errors.push(s.id+': Góc vectơ không xác định vì vectơ nguồn bằng 0');
    if(s.type==='polygon'){
      if(p.some(pt=>pt.z!==undefined)){
        let ax=0,ay=0,az=0;
        for(let i=0;i<p.length;i++){const c=cross3D(p[i],p[(i+1)%p.length]);ax+=c.x;ay+=c.y;az+=c.z;}
        if(Math.hypot(ax,ay,az)<EPS)errors.push(s.id+': Đa giác có diện tích bằng 0 hoặc tự cắt');
      }else{
        let area=0;
        for(let i=0;i<p.length;i++)area+=cross(p[i],p[(i+1)%p.length]);
        if(Math.abs(area)<EPS)errors.push(s.id+': Đa giác có diện tích bằng 0 hoặc tự cắt');
      }
    }
  }

  if(doc.solid?.segments){
    for(const s of doc.solid.segments){
      const p=s.refs.map(id=>points[id]);
      if(p.some(v=>!v)){errors.push(s.id+': Nguồn của đoạn thẳng không xác định');continue;}
      const dist=(p[0].z!==undefined||p[1].z!==undefined)
        ? norm3D(sub(p[1],p[0]))
        : norm(sub(p[1],p[0]));
      if(dist<EPS)errors.push(s.id+': Hai điểm trùng nhau, đối tượng suy biến');
    }
  }

  return{points,solidPoints,errors};
}
export function movePoint(doc,id,x,y,z){
  const next=structuredClone(doc);
  let p=next.points.find(p=>p.id===id);
  if(!p&&next.solid?.points)p=next.solid.points.find(p=>p.id===id);
  if(!p||!finite(x)||!finite(y)||(z!==undefined&&!finite(z)))return next;
  if(!p.kind||p.kind==='free'||p.kind==='preset'){
    p.x=x;p.y=y;
    if(z!==undefined||p.z!==undefined)p.z=z??p.z??0;
  }else if(['onLine','onCircle'].includes(p.kind)){
    const q=resolve(doc).points,[a,b]=p.refs.map(r=>q[r]);
    if(!a||!b)return next;
    const v=sub(b,a);
    if(norm(v)<EPS)return next;
    if(p.kind==='onLine')p.t=dot(sub({x,y,z},a),v)/dot(v,v);
    else p.angle=Math.atan2(y-a.y,x-a.x);
  }
  return next;
}
export function removePoint(doc,id){
  const next=structuredClone(doc),removed=new Set([id]);
  let size;
  do{
    size=removed.size;
    for(const p of next.points)if(p.refs?.some(r=>removed.has(r)))removed.add(p.id);
    if(next.solid?.points)for(const p of next.solid.points)if(p.refs?.some(r=>removed.has(r)))removed.add(p.id);
  }while(size!==removed.size);
  next.points=next.points.filter(p=>!removed.has(p.id));
  next.shapes=next.shapes.filter(s=>!s.refs.some(r=>removed.has(r)));
  if(next.solid?.points)next.solid.points=next.solid.points.filter(p=>!removed.has(p.id));
  if(next.solid?.segments)next.solid.segments=next.solid.segments.filter(s=>!s.refs.some(r=>removed.has(r)));
  if(next.solid?.planes)next.solid.planes=next.solid.planes.filter(pl=>!pl.refs.some(r=>removed.has(r)));
  if(next.solid?.crossSections)next.solid.crossSections=next.solid.crossSections.filter(cs=>!(cs.planeRefs||cs.refs||[]).some(r=>removed.has(r)));
  return next;
}
export function triangleTemplate(){const d=emptyDocument();d.points=[{id:'A',x:-3,y:-2},{id:'B',x:4,y:-2},{id:'C',x:0,y:3},{id:'M',kind:'midpoint',refs:['A','B']},{id:'H',kind:'foot',refs:['C','A','B']}];d.shapes=[{id:'tri',type:'polygon',refs:['A','B','C'],color:'#176b52'},{id:'alt',type:'segment',refs:['C','H'],color:'#d09232',dashed:true},{id:'med',type:'segment',refs:['C','M'],color:'#789589',dashed:true},{id:'right',type:'angle',refs:['C','H','B'],mark:'right',color:'#d09232'}];return d;}

