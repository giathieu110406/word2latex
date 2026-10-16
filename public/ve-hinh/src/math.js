import {compileExpression,compileExpressionP,evaluateExpression,normalizeToLHS} from './expression.js';
const EPS=1e-9;
export const counts={midpoint:2,foot:[3,4],ratio:2,centroid:3,orthocenter:3,planeLineIntersection:5,parallel:3,perpendicular:3,equal:3,onLine:2,onCircle:2,intersection:4,lineCircle:4,circleCircle:4,bisector:3,vectorSum:4,vectorDifference:4,vectorScale:3,affine:2,rotate:2,circumcenter:3,incenter:3,tangent:3,reflectAxis:3,reflectCenter:2,translate:1,rotateAround:2,scaleFrom:2};
export const shapes={segment:[2,2],line:[2,2],ray:[2,2],vector:[2,2],circle:[2,2],polygon:[3,30],angle:[3,3],length:[2,2],dot:[4,4],vectorAngle:[4,4],vectorCoords:[2,2],arc:[3,3],sector:[3,3],ellipse:[2,3]};
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
  for(const s of d.shapes){
    if(!s||!Object.hasOwn(shapes,s.type)||typeof s.id!=='string'||!/^[A-Za-z][\w-]{0,39}$/.test(s.id)||ids.has(s.id))throw Error('Đối tượng trùng hoặc không hợp lệ');
    const range=shapes[s.type];ids.add(s.id);
    if(!Array.isArray(s.refs)||s.refs.length<range[0]||s.refs.length>range[1]||s.refs.some(r=>!byId.has(r)))throw Error('Tham chiếu đối tượng không hợp lệ');
    if(s.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.color))throw Error('Màu không hợp lệ');
    if(s.dashed!==undefined&&typeof s.dashed!=='boolean')throw Error('Kiểu nét không hợp lệ');
    if(s.mark!==undefined&&!['none','tick','double','triple','parallel','right','single'].includes(s.mark))throw Error('Ký hiệu không hợp lệ');
    if(s.strokeWidth!==undefined&&(!finite(s.strokeWidth)||s.strokeWidth<=0))throw Error('Độ dày nét không hợp lệ');
    if(s.fill!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.fill))throw Error('Màu tô không hợp lệ');
    if(s.fillOpacity!==undefined&&(!finite(s.fillOpacity)||s.fillOpacity<0||s.fillOpacity>1))throw Error('Độ mờ không hợp lệ');
    if(s.rx!==undefined&&(!finite(s.rx)||s.rx<=0))throw Error('Bán trục rx không hợp lệ');
    if(s.ry!==undefined&&(!finite(s.ry)||s.ry<=0))throw Error('Bán trục ry không hợp lệ');
    if(s.visible!==undefined&&typeof s.visible!=='boolean')throw Error('Trạng thái hiển thị phải là boolean');
  }
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
  d.solid??=emptyDocument().solid;if(!['box','cube','pyramid','prism','tetrahedron','regular-tetrahedron','frustum','cylinder','cone','sphere','custom'].includes(d.solid.type)||!finite(d.solid.rotation)||!finite(d.solid.tilt)||(d.solid.sides!==undefined&&(!Number.isInteger(d.solid.sides)||d.solid.sides<3||d.solid.sides>12)))throw Error('Mô hình không gian không hợp lệ');
  const solid=d.solid;
  const faceCount=solid.type==='sphere'?0:solid.type==='cone'?1:solid.type==='cylinder'?2:['box','cube','frustum'].includes(solid.type)?6:['tetrahedron','regular-tetrahedron'].includes(solid.type)?4:solid.type==='custom'?0:(solid.sides??(solid.type==='prism'?3:4))+(solid.type==='prism'?2:1);
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
      if(pl.transparent!==undefined&&typeof pl.transparent!=='boolean')throw Error('Trạng thái trong suốt phải là boolean');
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
    case 'orthocenter': {
      if (a.z !== undefined || b.z !== undefined || c.z !== undefined) {
        const u = sub(b, a), v = sub(c, a);
        const n = cross3D(u, v);
        const nLenSq = dot(n, n);
        if (nLenSq < EPS) throw Error('Ba đỉnh thẳng hàng / trùng nhau');
        const vec = sub(mul(v, dot(u, u)), mul(u, dot(v, v)));
        const circum = add(a, mul(cross3D(vec, n), 0.5 / nLenSq));
        return sub(add(add(a, b), c), mul(circum, 2));
      } else {
        const u = sub(b, a), v = sub(c, a), den = 2 * (u.x * v.y - u.y * v.x);
        if (Math.abs(den) < EPS) throw Error('Ba đỉnh thẳng hàng / trùng nhau');
        const U = dot(u, u), V = dot(v, v);
        const circum = add(a, { x: (v.y * U - u.y * V) / den, y: (u.x * V - v.x * U) / den });
        return sub(add(add(a, b), c), mul(circum, 2));
      }
    }
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
    if(['arc','sector'].includes(s.type)){
      if(norm(sub(p[1],p[0]))<EPS)errors.push(s.id+': Bán kính cung/quạt tròn bằng 0');
      if(norm(sub(p[2],p[0]))<EPS)errors.push(s.id+': Điểm định hướng cung/quạt tròn trùng tâm');
    }
    if(s.type==='ellipse'){
      if(norm(sub(p[1],p[0]))<EPS)errors.push(s.id+': Bán trục chính elip bằng 0');
      if(p.length>=3&&norm(sub(p[2],p[0]))<EPS)errors.push(s.id+': Bán trục phụ elip bằng 0');
    }
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

export function findSnapTarget(x, y, doc, options = {}) {
  const radius = options.radius ?? 0.28;
  const snapPoints = options.snapPoints !== false;
  const snapMidpoints = options.snapMidpoints !== false;
  const snapGrid = options.snapGrid === true;
  const gridStep = options.gridStep ?? 1;

  let best = { x, y, type: null, dist: Infinity };

  // 1. Point Snap (highest priority)
  if (snapPoints && doc?.points) {
    const resolved = resolve(doc).points;
    for (const p of doc.points) {
      if (p.visible === false) continue;
      const rp = resolved[p.id];
      if (!rp) continue;
      const d = Math.hypot(rp.x - x, rp.y - y);
      if (d < radius && d < best.dist) {
        best = { x: rp.x, y: rp.y, type: 'point', refId: p.id, label: p.label || p.id, dist: d };
      }
    }
  }

  // 2. Midpoint Snap (second priority)
  if (snapMidpoints && doc?.shapes) {
    const resolved = resolve(doc).points;
    for (const s of doc.shapes) {
      if (s.visible === false) continue;
      const refs = s.refs || [];

      // 2a. Segment & Polygon Midpoints
      if (['segment', 'polygon'].includes(s.type)) {
        const edgeCount = s.type === 'polygon' ? refs.length : refs.length - 1;
        for (let i = 0; i < edgeCount; i++) {
          const id1 = refs[i];
          const id2 = refs[(i + 1) % refs.length];
          const p1 = resolved[id1];
          const p2 = resolved[id2];
          if (!p1 || !p2) continue;
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const d = Math.hypot(mx - x, my - y);
          if (d < radius && d < best.dist) {
            best = { x: mx, y: my, type: 'midpoint', refId: s.id, edgeRefs: [id1, id2], dist: d };
          }
        }
      }

      // 2b. Arc & Sector Midpoint Snap
      if (['arc', 'sector'].includes(s.type) && refs.length >= 3) {
        const O = resolved[refs[0]];
        const A = resolved[refs[1]];
        const B = resolved[refs[2]];
        if (O && A && B) {
          const R = Math.hypot(A.x - O.x, A.y - O.y);
          if (R >= EPS) {
            const alpha = Math.atan2(A.y - O.y, A.x - O.x);
            const beta = Math.atan2(B.y - O.y, B.x - O.x);
            let sweep = beta - alpha;
            if (sweep < 0) sweep += 2 * Math.PI;
            if (sweep < 1e-4) sweep = 2 * Math.PI;
            const midAngle = alpha + sweep / 2;
            const mx = O.x + R * Math.cos(midAngle);
            const my = O.y + R * Math.sin(midAngle);
            const d = Math.hypot(mx - x, my - y);
            if (d < radius && d < best.dist) {
              best = { x: mx, y: my, type: 'midpoint', refId: s.id, subType: 'arcMidpoint', dist: d };
            }
          }
        }
      }

      // 2c. Ellipse Vertices Snap
      if (s.type === 'ellipse' && refs.length >= 2) {
        const C = resolved[refs[0]];
        const A = resolved[refs[1]];
        if (C && A) {
          const u = sub(A, C);
          const rx = s.rx && s.rx > 0 ? s.rx : Math.hypot(u.x, u.y);
          if (rx >= EPS) {
            const distAC = Math.hypot(u.x, u.y) || 1;
            const ux = u.x / distAC, uy = u.y / distAC;
            const vx = -uy, vy = ux;
            let ry = s.ry && s.ry > 0 ? s.ry : null;
            if (!ry && refs.length >= 3 && resolved[refs[2]]) {
              const B = resolved[refs[2]];
              const w = sub(B, C);
              const proj = Math.abs(w.x * vx + w.y * vy);
              ry = proj > 1e-6 ? proj : Math.hypot(w.x, w.y);
            }
            if (!ry || ry <= 0) ry = 0.6 * rx;

            const vertices = [
              { x: C.x + rx * ux, y: C.y + rx * uy },
              { x: C.x - rx * ux, y: C.y - rx * uy },
              { x: C.x + ry * vx, y: C.y + ry * vy },
              { x: C.x - ry * vx, y: C.y - ry * vy }
            ];
            for (const v of vertices) {
              const d = Math.hypot(v.x - x, v.y - y);
              if (d < radius && d < best.dist) {
                best = { x: v.x, y: v.y, type: 'midpoint', refId: s.id, subType: 'ellipseVertex', dist: d };
              }
            }
          }
        }
      }
    }
  }

  // 3. Grid Snap (fallback)
  if (best.type === null && snapGrid) {
    const gx = Math.round(x / gridStep) * gridStep;
    const gy = Math.round(y / gridStep) * gridStep;
    const d = Math.hypot(gx - x, gy - y);
    if (d < radius * 0.75) {
      best = { x: gx, y: gy, type: 'grid', dist: d };
    }
  }

  return best;
}

export const STANDARD_SNAP_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165];

export function findAngularSnap(originX, originY, targetX, targetY, options = {}) {
  const thresholdDeg = options.thresholdDeg ?? 4.0;
  const angles = options.angles || STANDARD_SNAP_ANGLES;

  const dx = targetX - originX;
  const dy = targetY - originY;
  const len = Math.hypot(dx, dy);

  if (len < 0.1) {
    return { x: targetX, y: targetY, angleDeg: 0, snapped: false, isRightAngle: false, length: len };
  }

  let rawAngleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

  let closestAngle = null;
  let minDiff = Infinity;

  for (const a of angles) {
    let diff = Math.abs(rawAngleDeg - a);
    if (diff > 180) diff = Math.abs(diff - 360);
    if (diff < minDiff) {
      minDiff = diff;
      closestAngle = a;
    }
  }

  if (minDiff <= thresholdDeg && closestAngle !== null) {
    const rad = closestAngle * Math.PI / 180;
    const sx = originX + len * Math.cos(rad);
    const sy = originY + len * Math.sin(rad);
    const isRightAngle = Math.abs(Math.abs(closestAngle) - 90) < 1e-4;
    return {
      x: sx,
      y: sy,
      angleDeg: closestAngle < 0 ? closestAngle + 360 : closestAngle,
      snapped: true,
      isRightAngle,
      length: len
    };
  }

  const normalizedRaw = rawAngleDeg < 0 ? rawAngleDeg + 360 : rawAngleDeg;
  return {
    x: targetX,
    y: targetY,
    angleDeg: normalizedRaw,
    snapped: false,
    isRightAngle: false,
    length: len
  };
}

export function findAlignmentGuides(dragId, x, y, doc, options = {}) {
  const threshold = options.threshold ?? 0.15;
  if (!doc?.points) {
    return { x, y, guides: [] };
  }
  const resolved = resolve(doc).points;
  let snappedX = x;
  let snappedY = y;
  const guides = [];

  let bestDiffX = threshold;
  let bestX = null;
  let guideX = null;

  let bestDiffY = threshold;
  let bestY = null;
  let guideY = null;

  for (const p of doc.points) {
    if (p.id === dragId || p.visible === false) continue;
    const rp = resolved[p.id];
    if (!rp) continue;

    const diffX = Math.abs(rp.x - x);
    if (diffX < bestDiffX) {
      bestDiffX = diffX;
      bestX = rp.x;
      guideX = { axis: 'x', val: rp.x, targetId: p.id, targetY: rp.y };
    }

    const diffY = Math.abs(rp.y - y);
    if (diffY < bestDiffY) {
      bestDiffY = diffY;
      bestY = rp.y;
      guideY = { axis: 'y', val: rp.y, targetId: p.id, targetX: rp.x };
    }
  }

  if (bestX !== null) {
    snappedX = bestX;
    guides.push(guideX);
  }
  if (bestY !== null) {
    snappedY = bestY;
    guides.push(guideY);
  }

  return { x: snappedX, y: snappedY, guides };
}

export function findGeometricAngle(pA, pB, pC) {
  if (!pA || !pB || !pC) return 0;
  const dxA = pA.x - pB.x;
  const dyA = pA.y - pB.y;
  const dxC = pC.x - pB.x;
  const dyC = pC.y - pB.y;
  const lenA = Math.hypot(dxA, dyA);
  const lenC = Math.hypot(dxC, dyC);
  if (lenA < 1e-6 || lenC < 1e-6) return 0;
  const dot = dxA * dxC + dyA * dyC;
  const cosVal = Math.max(-1, Math.min(1, dot / (lenA * lenC)));
  return Math.acos(cosVal) * 180 / Math.PI;
}

/**
 * Đo góc giữa 2 đường thẳng trong không gian 3D (rad in [0, pi/2]).
 * cos(theta) = |u . v| / (|u| * |v|)
 * Hỗ trợ (p1, p2, p3, p4) hoặc ([p1, p2], [p3, p4]).
 */
export function angleBetweenLines3D(p1, p2, p3, p4) {
  let a = p1, b = p2, c = p3, d = p4;
  if (Array.isArray(p1) && Array.isArray(p2)) {
    [a, b] = p1;
    [c, d] = p2;
  }
  if (!a || !b || !c || !d) throw Error('Thiếu điểm xác định đường thẳng');
  const u = sub(b, a);
  const v = sub(d, c);
  const lenU = norm3D(u);
  const lenV = norm3D(v);
  if (lenU < EPS || lenV < EPS) throw Error('Đường thẳng có hai điểm trùng nhau');
  const cosVal = Math.abs(dot(u, v)) / (lenU * lenV);
  return Math.acos(Math.max(0, Math.min(1, cosVal)));
}

/**
 * Đo góc giữa đường thẳng và mặt phẳng trong không gian 3D (rad in [0, pi/2]).
 * sin(phi) = |u . n| / (|u| * |n|)
 * Hỗ trợ (l1, l2, p1, p2, p3) hoặc ([l1, l2], [p1, p2, p3]).
 */
export function angleLinePlane3D(l1, l2, p1, p2, p3) {
  let la = l1, lb = l2, pa = p1, pb = p2, pc = p3;
  if (Array.isArray(l1) && Array.isArray(l2)) {
    [la, lb] = l1;
    [pa, pb, pc] = l2;
  }
  if (!la || !lb || !pa || !pb || !pc) throw Error('Thiếu điểm xác định đường thẳng hoặc mặt phẳng');
  const u = sub(lb, la);
  const lenU = norm3D(u);
  if (lenU < EPS) throw Error('Đường thẳng có hai điểm trùng nhau');
  const v1 = sub(pb, pa);
  const v2 = sub(pc, pa);
  const n = cross3D(v1, v2);
  const lenN = norm3D(n);
  if (lenN < EPS) throw Error('Ba điểm mặt phẳng thẳng hàng / trùng nhau');
  const sinVal = Math.abs(dot(u, n)) / (lenU * lenN);
  return Math.asin(Math.max(0, Math.min(1, sinVal)));
}

/**
 * Đo góc nhị diện (góc giữa 2 mặt phẳng) trong không gian 3D (rad in [0, pi/2]).
 * cos(alpha) = |n1 . n2| / (|n1| * |n2|)
 * Hỗ trợ ([p1, p2, p3], [q1, q2, q3], pointsMap?) hoặc (p1, p2, p3, q1, q2, q3).
 */
export function dihedralAngle3D(plane1, plane2, ...rest) {
  let pts1, pts2;
  const pointsMap = rest.find(arg => arg && typeof arg === 'object' && arg.x === undefined && arg.y === undefined);
  if (Array.isArray(plane1) && Array.isArray(plane2)) {
    pts1 = plane1;
    pts2 = plane2;
  } else {
    pts1 = [plane1, plane2, rest[0]];
    pts2 = [rest[1], rest[2], rest[3]];
  }
  const resolvePt = p => {
    if (typeof p !== 'string') return p;
    if (!pointsMap) return p;
    if (Array.isArray(pointsMap)) return pointsMap.find(pt => pt.id === p);
    return pointsMap[p];
  };
  const [p1, p2, p3] = pts1.map(resolvePt);
  const [q1, q2, q3] = pts2.map(resolvePt);
  if (!p1 || !p2 || !p3 || !q1 || !q2 || !q3) throw Error('Thiếu điểm xác định hai mặt phẳng');
  const n1 = cross3D(sub(p2, p1), sub(p3, p1));
  const n2 = cross3D(sub(q2, q1), sub(q3, q1));
  const len1 = norm3D(n1);
  const len2 = norm3D(n2);
  if (len1 < EPS || len2 < EPS) throw Error('Ba điểm mặt phẳng thẳng hàng / trùng nhau');
  const cosVal = Math.abs(dot(n1, n2)) / (len1 * len2);
  return Math.acos(Math.max(0, Math.min(1, cosVal)));
}

/**
 * Tính khoảng cách từ 1 điểm đến 1 mặt phẳng trong không gian 3D (d >= 0).
 * d = |(M - P1) . n| / |n|
 * Hỗ trợ (pt, p1, p2, p3) hoặc (pt, [p1, p2, p3]) hoặc (ptId, [r1, r2, r3], pointsMap).
 */
export function distancePointToPlane3D(point, p1, p2, p3, maybePointsMap) {
  let pointsMap = maybePointsMap;
  if (Array.isArray(p1) && typeof p2 === 'object' && p2 !== null && p2.x === undefined && !Array.isArray(p2)) {
    pointsMap = p2;
  } else if (Array.isArray(p1) && Array.isArray(p2)) {
    pointsMap = p2;
  } else if (typeof p3 === 'object' && p3 !== null && p3.x === undefined && !Array.isArray(p3)) {
    pointsMap = p3;
  }
  const resolvePt = p => {
    if (typeof p !== 'string') return p;
    if (!pointsMap) return p;
    if (Array.isArray(pointsMap)) return pointsMap.find(pt => pt.id === p);
    return pointsMap[p];
  };
  const pt = resolvePt(point);
  if (!pt) throw Error('Thiếu điểm cần tính khoảng cách');
  let a, b, c;
  if (Array.isArray(p1)) {
    [a, b, c] = p1.map(resolvePt);
  } else {
    a = resolvePt(p1);
    b = resolvePt(p2);
    c = resolvePt(p3);
  }
  if (!a || !b || !c) throw Error('Thiếu điểm xác định mặt phẳng');
  const n = cross3D(sub(b, a), sub(c, a));
  const lenN = norm3D(n);
  if (lenN < EPS) throw Error('Ba điểm mặt phẳng thẳng hàng / trùng nhau');
  const diff = sub(pt, a);
  return Math.abs(dot(diff, n)) / lenN;
}



