import {emptyDocument,triangleTemplate,validateDocument} from './math.js';
export const templateNames={triangle:'Tam giác · đường cao',equilateral:'Tam giác đều',isosceles:'Tam giác cân',rightTriangle:'Tam giác vuông',parallelogram:'Hình bình hành',rectangle:'Hình chữ nhật',rhombus:'Hình thoi',square:'Hình vuông',trapezoid:'Hình thang cân',regular:'Đa giác đều',circumcircle:'Tròn ngoại tiếp tam giác',incircle:'Tròn nội tiếp tam giác',circle:'Tròn · tiếp tuyến',vectors:'Cộng hai vectơ',difference:'Hiệu hai vectơ',scalar:'Nhân vectơ với số',division:'Điểm chia đoạn',blank:'Bảng vẽ trống'};
export function templateDocument(name,{sides=6}={}){
  if(name==='triangle')return triangleTemplate();const d=emptyDocument();if(name==='blank')return d;if(!Object.hasOwn(templateNames,name))throw Error('Mẫu chưa hỗ trợ');d.title=templateNames[name];
  const point=(id,x,y)=>d.points.push({id,x,y}),dep=(id,kind,refs,params={})=>d.points.push({id,kind,refs,...params});
  const shape=(id,type,refs,extra={})=>d.shapes.push({id,type,refs,color:'#176b52',...extra});
  if(['equilateral','isosceles','rightTriangle','circumcircle','incircle'].includes(name)){
    point('A',-3,-2);point('B',3,-2);
    if(name==='circumcircle'||name==='incircle')point('C',0,3);else dep('C','affine',['A','B'],{u:name==='rightTriangle'?0:.5,v:name==='equilateral'?Math.sqrt(3)/2:.8});shape('triangle','polygon',['A','B','C']);
    if(name==='circumcircle'){dep('O','circumcenter',['A','B','C']);shape('circumcircle','circle',['O','A']);}
    if(name==='incircle'){dep('I','incenter',['A','B','C']);dep('H','foot',['I','A','B']);dep('J','foot',['I','B','C']);dep('K','foot',['I','C','A']);shape('incircle','circle',['I','H']);for(const id of ['H','J','K'])shape('radius'+id,'segment',['I',id],{dashed:true,color:'#d09232'});}
    if(name==='rightTriangle')shape('angle','angle',['B','A','C'],{mark:'right'});
  }else if(['parallelogram','rectangle','rhombus','square','trapezoid'].includes(name)){
    point('A',-2,-2);point('B',2,-2);
    if(name==='parallelogram'){point('C',3,2);dep('D','vectorSum',['B','A','B','C']);}
    else{const u=name==='trapezoid'?.8:name==='rhombus'?1.5:1,v=name==='square'?1:name==='rhombus'?Math.sqrt(3)/2:.8;dep('C','affine',['A','B'],{u,v});dep('D','affine',['A','B'],{u:name==='trapezoid'?.2:name==='rhombus'?.5:0,v});}shape('quad','polygon',['A','B','C','D']);
  }else if(name==='regular'){
    if(!Number.isInteger(sides)||sides<3||sides>12)throw Error('Đa giác đều cần 3–12 cạnh');point('O',0,0);point('A',3,0);const refs=['A'];for(let i=1;i<sides;i++){const id=String.fromCharCode(65+i);dep(id,'rotate',['O','A'],{angle:2*Math.PI*i/sides});refs.push(id);}shape('regular','polygon',refs);d.title=`Đa giác đều ${sides} cạnh`;
  }else if(name==='circle'){
    point('O',0,0);point('R',2,0);point('P',5,1);dep('T','tangent',['P','O','R'],{branch:1});dep('U','tangent',['P','O','R'],{branch:-1});shape('circle','circle',['O','R']);shape('t1','line',['P','T']);shape('t2','line',['P','U'],{dashed:true});
  }else if(['vectors','difference','scalar'].includes(name)){
    point('O',-2,-1);point('A',2,0);point('B',-1,2);dep('S',name==='vectors'?'vectorSum':name==='difference'?'vectorDifference':'vectorScale',name==='scalar'?['O','O','A']:['O','A','O','B'],name==='scalar'?{factor:.5}:{});shape('u','vector',['O','A']);shape('v','vector',['O','B'],{color:'#d09232'});shape('result','vector',['O','S'],{color:'#527da0'});shape('dot','dot',['O','A','O','B']);shape('coords','vectorCoords',['O','S']);
  }else if(name==='division'){point('A',-3,-1);point('B',3,2);dep('M','onLine',['A','B'],{t:1/3});shape('segment','segment',['A','B']);shape('first','length',['A','M']);shape('second','length',['M','B']);}
  return validateDocument(d);
}
