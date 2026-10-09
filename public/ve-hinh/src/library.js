import {emptyDocument,validateDocument} from './math.js';
import {templateDocument,templateNames} from './templates.js';

// Catalog entries use the same editable document model as the canvas.
const oldDescriptions={triangle:'Tam giác với đường cao và trung tuyến.',equilateral:'Ba cạnh bằng nhau khi kéo cạnh nguồn.',isosceles:'Hai cạnh bên bằng nhau.',rightTriangle:'Góc vuông giữ theo cạnh đáy.',parallelogram:'Hai cặp cạnh đối song song.',rectangle:'Bốn góc vuông, cạnh đối bằng nhau.',rhombus:'Bốn cạnh bằng nhau.',square:'Bốn cạnh bằng nhau, bốn góc vuông.',trapezoid:'Hai đáy song song, hai cạnh bên bằng nhau.',circumcircle:'Đường tròn đi qua ba đỉnh.',incircle:'Đường tròn tiếp xúc ba cạnh.',circle:'Hai tiếp tuyến từ một điểm ngoài.',vectors:'Tổng hai vectơ và tọa độ kết quả.',difference:'Hiệu hai vectơ chung gốc.',scalar:'Điều chỉnh hệ số nhân trong thuộc tính.',division:'Điểm chia đoạn theo tham số t.'};
const oldGroups=[['Tam giác',['triangle','equilateral','isosceles','rightTriangle']],['Tứ giác',['parallelogram','rectangle','rhombus','square','trapezoid']],['Đường tròn',['circumcircle','incircle','circle']],['Vectơ & điểm',['vectors','difference','scalar','division']]];
const geometry=oldGroups.flatMap(([category,ids])=>ids.map(id=>({id,label:templateNames[id],category,description:oldDescriptions[id],create:()=>templateDocument(id)})));
for(let n=3;n<=12;n++)geometry.push({id:'regular:'+n,label:'Đa giác đều '+n+' cạnh',category:'Đa giác đều',description:'Các cạnh và góc bằng nhau; kéo tâm hoặc đỉnh nguồn.',create:()=>templateDocument('regular',{sides:n})});
const extraGeometry=[
 ['medians','Ba đường trung tuyến','Tam giác','Ba trung tuyến của tam giác và trọng tâm.'],
 ['centroid','Trọng tâm tam giác','Tam giác','G chia mỗi trung tuyến theo tỉ số 2 : 1.'],
 ['orthocenter','Trực tâm tam giác','Tam giác','Hai đường cao cắt nhau tại trực tâm H.'],
 ['bisectors','Ba đường phân giác','Tam giác','Các phân giác đi qua tâm nội tiếp I.'],
 ['midsegment','Đường trung bình','Tam giác','MN song song BC và bằng một nửa BC.'],
 ['thales','Định lí Thalès','Tam giác','MN song song BC; hai điểm chia cạnh cùng tỉ số.'],
 ['right-altitude','Đường cao trong tam giác vuông','Tam giác','Đường cao từ đỉnh vuông góc xuống cạnh huyền.'],
 ['kite','Tứ giác hai cặp cạnh kề bằng nhau','Tứ giác','Hai cặp cạnh kề bằng nhau; trục đối xứng AC.'],
 ['right-trapezoid','Hình thang vuông','Tứ giác','Hai đáy song song và một cạnh bên vuông góc đáy.'],
 ['inscribed-angle','Góc nội tiếp & góc ở tâm','Đường tròn','Góc ở tâm gấp đôi góc nội tiếp khi C nằm ngoài cung nhỏ AB.'],
 ['diameter-angle','Góc chắn nửa đường tròn','Đường tròn','Góc nội tiếp chắn đường kính luôn là góc vuông.'],
 ['chord-bisector','Đường kính vuông góc dây','Đường tròn','Đường qua tâm và trung điểm dây vuông góc dây.'],
 ['cyclic-quad','Tứ giác nội tiếp','Đường tròn','Bốn đỉnh cùng thuộc một đường tròn.'],
 ['concentric','Hai đường tròn đồng tâm','Đường tròn','Cùng tâm O; bán kính thứ hai bằng 1,6 lần bán kính gốc.'],
 ['circle-intersections','Hai đường tròn cắt nhau','Đường tròn','Hai giao điểm phụ thuộc tâm và bán kính.'],
 ['line-circle','Cát tuyến và đường tròn','Đường tròn','Hai giao điểm của một đường thẳng và đường tròn.'],
 ['axis-symmetry','Đối xứng qua trục','Biến hình','Tam giác và ảnh đối xứng qua đường UV.'],
 ['center-symmetry','Đối xứng qua tâm','Biến hình','Tam giác và ảnh đối xứng qua tâm O.'],
 ['rotation','Quay tam giác 90°','Biến hình','Quay quanh tâm O; ảnh theo các điểm nguồn.'],
 ['homothety','Vị tự tam giác','Biến hình','Vị tự tâm O, hệ số −0,7 có thể chỉnh.'],
 ['translation','Tịnh tiến tam giác','Biến hình','Ảnh tam giác theo vectơ UV, kéo U/V để đổi hướng.']
];
for(const [id,label,category,description]of extraGeometry)geometry.push({id,label,category,description,create:()=>geometryExample(id)});
function geometryExample(id){
 const d=emptyDocument();let shapeIndex=0;
 const point=(id,x,y,extra={})=>d.points.push({id,x,y,...extra});
 const dep=(id,kind,refs,extra={})=>d.points.push({id,kind,refs,...extra});
 const shape=(type,refs,extra={})=>d.shapes.push({id:'shape'+(++shapeIndex),type,refs,color:'#176b52',...extra});
 const triangle=()=>{point('A',-3,-2);point('B',3,-2);point('C',-1,3);shape('polygon',['A','B','C']);};
 const circle=()=>{point('O',0,0);point('R',3,0);shape('circle',['O','R']);};
 const onCircle=(id,angle)=>dep(id,'onCircle',['O','R'],{angle});
 if(['medians','centroid','orthocenter','bisectors','midsegment','thales'].includes(id)){
  triangle();
  if(id==='orthocenter'){dep('D','foot',['A','B','C']);dep('E','foot',['B','A','C']);dep('H','intersection',['A','D','B','E']);shape('line',['A','D'],{dashed:true});shape('line',['B','E'],{dashed:true});}
  else if(id==='bisectors'){dep('I','incenter',['A','B','C']);for(const p of ['A','B','C'])shape('segment',[p,'I'],{dashed:true});}
  else if(['midsegment','thales'].includes(id)){if(id==='midsegment'){dep('M','midpoint',['A','B']);dep('N','midpoint',['A','C']);}else{dep('M','onLine',['A','B'],{t:.4});dep('D','parallel',['M','B','C'],{visible:false});dep('N','intersection',['M','D','A','C']);}shape('segment',['M','N'],{color:'#d09232'});shape('length',['M','N']);shape('length',['B','C']);}
  else{dep('M','midpoint',['B','C']);dep('N','midpoint',['C','A']);dep('P','midpoint',['A','B']);dep('G','intersection',['A','M','B','N']);for(const [p,q]of [['A','M'],['B','N'],['C','P']])shape('segment',[p,q],{dashed:true});}
 }else if(id==='right-altitude'){
  const base=templateDocument('rightTriangle');d.points=base.points;d.shapes=base.shapes;shapeIndex=20;dep('H','foot',['A','B','C']);shape('segment',['A','H'],{dashed:true,color:'#d09232'});shape('angle',['A','H','B'],{mark:'right'});
 }else if(id==='kite'){
  point('A',0,3);point('B',-2,0);point('C',0,-2);dep('J','foot',['B','A','C'],{visible:false});dep('D','vectorScale',['J','J','B'],{factor:-1});shape('polygon',['A','B','C','D']);shape('segment',['A','C'],{dashed:true});
 }else if(id==='right-trapezoid'){
  point('A',-3,-2);point('B',3,-2);dep('C','affine',['A','B'],{u:.75,v:.65});dep('D','affine',['A','B'],{u:0,v:.65});shape('polygon',['A','B','C','D']);shape('angle',['B','A','D'],{mark:'right'});
 }else if(['axis-symmetry','center-symmetry','rotation','homothety','translation'].includes(id)){
  point('A',-4,-2);point('B',-2,-2);point('C',-3,.5);shape('polygon',['A','B','C']);
  if(id==='axis-symmetry'){point('U',0,-3);point('V',0,3);shape('line',['U','V'],{dashed:true});}
  else if(id==='translation'){point('U',0,0);point('V',3,1);shape('vector',['U','V'],{color:'#d09232'});}else point('O',0,0);
  for(const p of ['A','B','C']){const image=p+'2',label=p+'′';
   if(id==='axis-symmetry'){dep(p+'H','foot',[p,'U','V'],{visible:false});dep(image,'vectorScale',[p+'H',p+'H',p],{factor:-1,label});}
   if(id==='center-symmetry')dep(image,'vectorScale',['O','O',p],{factor:-1,label});
   if(id==='rotation')dep(image,'rotate',['O',p],{angle:Math.PI/2,label});
   if(id==='homothety')dep(image,'vectorScale',['O','O',p],{factor:-.7,label});
   if(id==='translation')dep(image,'vectorSum',[p,p,'U','V'],{label});
  }shape('polygon',['A2','B2','C2'],{color:'#527da0',dashed:true});
 }else{
  circle();
  if(id==='concentric'){dep('S','vectorScale',['O','O','R'],{factor:1.6});shape('circle',['O','S'],{color:'#527da0'});}
  if(id==='cyclic-quad'){for(const [i,a]of [['A',.2],['B',1.8],['C',3.2],['D',4.5]])onCircle(i,a);shape('polygon',['A','B','C','D']);}
  if(id==='inscribed-angle'){onCircle('A',-.4);onCircle('B',2.4);onCircle('C',4.3);shape('polygon',['A','B','C']);shape('segment',['O','A'],{dashed:true});shape('segment',['O','B'],{dashed:true});shape('angle',['A','C','B']);shape('angle',['A','O','B'],{color:'#d09232'});}
  if(id==='diameter-angle'){onCircle('A',Math.PI);onCircle('C',1.1);shape('polygon',['A','R','C']);shape('angle',['A','C','R'],{mark:'right'});}
  if(id==='chord-bisector'){onCircle('A',.4);onCircle('B',2.4);dep('M','midpoint',['A','B']);dep('D','perpendicular',['M','A','B'],{visible:false});shape('segment',['A','B']);shape('line',['M','D'],{dashed:true});shape('segment',['O','M'],{color:'#d09232'});shape('angle',['O','M','A'],{mark:'right'});}
  if(id==='circle-intersections'){point('P',3,0);dep('S','vectorSum',['P','P','O','R']);shape('circle',['P','S'],{color:'#527da0'});dep('A','circleCircle',['O','R','P','S'],{branch:1});dep('B','circleCircle',['O','R','P','S'],{branch:-1});shape('segment',['A','B'],{dashed:true});}
  if(id==='line-circle'){point('A',-4,-1);point('B',4,1);shape('line',['A','B']);dep('X','lineCircle',['A','B','O','R'],{branch:1});dep('Y','lineCircle',['A','B','O','R'],{branch:-1});shape('segment',['X','Y'],{color:'#d09232'});}
 }return validateDocument(d);
}
const graphRows=[
 ['proportional','Tỉ lệ thuận y = ax','THCS & bậc hai','Đường thẳng qua gốc; thay hệ số a.',['a*x'],{a:1}],
 ['linear','Hàm số bậc nhất','THCS & bậc hai','Đổi hệ số góc a và tung độ gốc b.',['a*x+b'],{a:1,b:1}],
 ['parallel-lines','Hai đường song song','THCS & bậc hai','Cùng hệ số góc, khác tung độ gốc.',['a*x+1','a*x-2'],{a:1}],
 ['intersect-lines','Hai đường cắt nhau','THCS & bậc hai','Giao của y=x+1 và y=−x+1.',['x+1','-x+1'],{}],
 ['quadratic','Parabol y = ax²','THCS & bậc hai','Parabol đỉnh O; thay dấu và độ lớn a.',['a*x^2'],{a:1}],
 ['translated-parabola','Parabol có đỉnh (h,k)','THCS & bậc hai','Dịch đỉnh bằng các tham số h và k.',['a*(x-h)^2+k'],{a:1,h:1,k:-2}],
 ['line-parabola','Đường thẳng & parabol','THCS & bậc hai','Quan sát giao điểm của hai đồ thị.',['x^2','x+2'],{}],
 ['quadratic-family','Họ parabol bậc hai','THCS & bậc hai','Các hệ số a,b,c đều chỉnh được.',['a*x^2+b*x+c'],{a:1,b:0,c:-1}],
 ['cubic','Hàm bậc ba','Khảo sát hàm số','y=x³−3x với hai cực trị.',['x^3-3*x'],{}],
 ['quartic','Hàm trùng phương','Khảo sát hàm số','Hàm chẵn y=x⁴−2x².',['x^4-2*x^2'],{}],
 ['rational','Phân thức bậc nhất / bậc nhất','Khảo sát hàm số','y=(x+1)/(x−1); hai nhánh qua tiệm cận.',['(x+1)/(x-1)'],{}],
 ['reciprocal','Tỉ lệ nghịch y = a/x','Khảo sát hàm số','Hai nhánh hyperbol; thay hệ số a.',['a/x'],{a:1}],
 ['square-root','Hàm căn bậc hai','Khảo sát hàm số','Miền xác định x≥0, y=√x.',['sqrt(x)'],{}],
 ['absolute','Hàm giá trị tuyệt đối','Khảo sát hàm số','Đồ thị hình chữ V, đỉnh (h,0).',['abs(x-h)'],{h:0}],
 ['sine','Hàm sin','Lượng giác','y=sin x; chu kì 2π, đơn vị radian.',['sin(x)'],{}],
 ['cosine','Hàm cos','Lượng giác','y=cos x; hàm chẵn và tuần hoàn.',['cos(x)'],{}],
 ['tangent','Hàm tan','Lượng giác','y=tan x với các nhánh gián đoạn.',['tan(x)'],{}],
 ['cotangent','Hàm cot','Lượng giác','y=cos x / sin x; không xác định khi sin x=0.',['cos(x)/sin(x)'],{}],
 ['sine-cosine','So sánh sin & cos','Lượng giác','Hai đồ thị cùng chu kì, lệch pha π/2.',['sin(x)','cos(x)'],{}],
 ['harmonic','Dao động A·sin(ωx+φ)','Lượng giác','Đổi biên độ a, tần số b và pha c.',['a*sin(b*x+c)'],{a:2,b:1,c:0}],
 ['exponential','Hàm mũ y = 2ˣ','Mũ & logarithm','Hàm tăng với cơ số 2.',['2^x'],{}],
 ['logarithm','Logarithm tự nhiên','Mũ & logarithm','y=ln x, chỉ xác định khi x>0.',['ln(x)'],{}],
 ['log10','Logarithm cơ số 10','Mũ & logarithm','y=log₁₀ x.',['log(x)'],{}],
 ['exp-log','Mũ & logarithm ngược nhau','Mũ & logarithm','y=eˣ, y=ln x và đường y=x.',['exp(x)','ln(x)','x'],{}],
 ['circle-equation','Phương trình đường tròn','Đường conic','x²+y²=9, tâm O và bán kính 3.',['x^2+y^2=9'],{}],
 ['ellipse','Elip','Đường conic','x²/16+y²/9=1, trục lớn theo Ox.',['x^2/16+y^2/9=1'],{}],
 ['hyperbola','Hyperbol','Đường conic','x²/4−y²/4=1, hai nhánh theo Ox.',['x^2/4-y^2/4=1'],{}],
 ['parabola-conic','Parabol dạng conic','Đường conic','y²=4x, đỉnh O, mở sang phải.',['y^2=4*x'],{}]
];
const colors=['#176b52','#d09232','#527da0'];
const graph=graphRows.map(([id,label,category,description,expressions,params])=>({id,label,category,description,create:()=>({enabled:true,expressions:expressions.map((expr,i)=>({id:'g'+(i+1),expr,color:colors[i%3],visible:true})),params:Object.entries(params).map(([name,value])=>({name,value,min:name==='b'&&id==='harmonic'?.1:-5,max:5}))})}));
const chartRows=[
 ['class-counts','Số học sinh các lớp','Cột & cột kép','Biểu đồ cột so sánh bốn lớp.','bar',['6A','6B','6C','6D'],[36,39,35,38]],
 ['score-frequency','Tần số điểm kiểm tra','Cột & cột kép','Tần số các điểm 5–10 của một lớp.','bar',['5','6','7','8','9','10'],[2,5,9,12,7,3]],
 ['relative-bars','Tần số tương đối (%)','Cột & cột kép','Các tỉ lệ minh họa cộng lại bằng 100%.','bar',['A','B','C','D'],[15,25,40,20]],
 ['two-classes','So sánh hai lớp','Cột & cột kép','Hai dãy tần số theo cùng nhóm điểm.','double',['5–6','7–8','9–10'],[8,18,10],[6,20,12]],
 ['two-years','So sánh hai năm','Cột & cột kép','Số thành viên bốn câu lạc bộ.','double',['Toán','Văn','Tin','Anh'],[20,25,30,28],[26,23,35,32]],
 ['temperature','Nhiệt độ theo ngày','Đoạn thẳng','Theo dõi xu hướng nhiệt độ trong tuần.','line',['T2','T3','T4','T5','T6','T7','CN'],[25,27,28,26,29,30,28]],
 ['monthly-growth','Số lượt mượn sách','Đoạn thẳng','Dữ liệu theo sáu tháng liên tiếp.','line',['T1','T2','T3','T4','T5','T6'],[32,40,38,52,61,65]],
 ['relative-pie','Tần số tương đối · quạt tròn','Quạt tròn','Bốn nhóm, tổng tỉ lệ 100%.','pie',['A','B','C','D'],[15,25,40,20]],
 ['activities','Thời gian hoạt động trong ngày','Quạt tròn','Phân bố 24 giờ của một ngày minh họa.','pie',['Ngủ','Học','Sinh hoạt','Giải trí'],[8,7,6,3]],
 ['score-histogram','Điểm ghép nhóm','Histogram','Khoảng điểm [0,2), [2,4), … có độ rộng 2.','histogram',['0–2','2–4','4–6','6–8','8–10'],[1,3,8,15,9],null,0,2],
 ['height-histogram','Chiều cao ghép nhóm','Histogram','Các khoảng chiều cao từ 140 cm, rộng 10 cm.','histogram',['140–150','150–160','160–170','170–180'],[4,12,15,5],null,140,10],
 ['time-histogram','Thời gian hoàn thành bài','Histogram','Các khoảng thời gian rộng 5 phút.','histogram',['0–5','5–10','10–15','15–20','20–25'],[2,8,14,9,3],null,0,5]
];
const chart=chartRows.map(([id,label,category,description,type,labels,values,second,start,width])=>({id,label,category,description:description+' Số liệu minh họa.',create:()=>({enabled:true,type,labels,values,second:second??values.map(()=>0),...(type==='histogram'?{start,width}:{})})}));
const solidRows=[
 ['box','Hình hộp chữ nhật','Hộp & lăng trụ','Sáu mặt chữ nhật; kéo để xoay góc nhìn.','box'],
 ['cube','Hình lập phương','Hộp & lăng trụ','Khối có các cạnh bằng nhau.','cube'],
 ['prism-triangle','Lăng trụ tam giác đều','Hộp & lăng trụ','Lăng trụ đứng, đáy tam giác đều.','prism',3],
 ['prism-square','Lăng trụ đáy vuông','Hộp & lăng trụ','Hai đáy vuông song song, cạnh bên thẳng đứng.','prism',4],
 ['prism-hexagon','Lăng trụ lục giác đều','Hộp & lăng trụ','Hai đáy lục giác đều và sáu mặt bên.','prism',6],
 ['tetrahedron','Tứ diện đều','Chóp & tứ diện','Bốn mặt tam giác đều.','tetrahedron'],
 ['pyramid-triangle','Chóp tam giác đều','Chóp & tứ diện','Đỉnh chiếu xuống tâm đáy tam giác đều.','pyramid',3],
 ['pyramid-square','Chóp tứ giác đều','Chóp & tứ diện','Đáy vuông, đỉnh nằm trên tâm đáy.','pyramid',4],
 ['pyramid-pentagon','Chóp ngũ giác đều','Chóp & tứ diện','Đáy ngũ giác đều, năm mặt bên.','pyramid',5],
 ['pyramid-hexagon','Chóp lục giác đều','Chóp & tứ diện','Đáy lục giác đều, sáu mặt bên.','pyramid',6],
 ['cylinder','Hình trụ','Khối tròn xoay','Hai đáy tròn, các đường sinh biên.','cylinder'],
 ['cone','Hình nón','Khối tròn xoay','Một đỉnh và một đáy tròn.','cone'],
 ['sphere','Hình cầu','Khối tròn xoay','Các đường tròn minh họa bề mặt cầu.','sphere']
];
const solid=solidRows.map(([id,label,category,description,type,sides])=>({id,label,category,description,create:()=>({enabled:true,type,rotation:30,tilt:20,...(sides?{sides}:{})})}));
export const templateLibrary={geometry,graph,chart,solid};
export function applyLibraryTemplate(source,mode,id){
 const entries=templateLibrary[mode];if(!entries)throw Error('Không gian mẫu không hợp lệ');
 const next=structuredClone(source);
 if(id==='blank'){
  if(mode==='geometry'){next.points=[];next.shapes=[];}else next[mode].enabled=false;
  next.title='Bảng trống · '+({geometry:'Hình học',graph:'Đồ thị',chart:'Thống kê',solid:'Không gian'})[mode];
 }else{
  const item=entries.find(t=>t.id===id);if(!item)throw Error('Mẫu không thuộc không gian hiện tại');
  const value=structuredClone(item.create());
  if(mode==='geometry'){next.points=value.points;next.shapes=value.shapes;}else next[mode]=value;
  next.title=item.label;
 }return validateDocument(next);
}
