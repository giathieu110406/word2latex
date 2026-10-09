// Restricted mathematical grammar. No eval, Function, properties or assignments.
export function compileExpression(source) {
  if(typeof source!=='string'||source.length>300) throw Error('Biểu thức quá dài');
  const tokens=source.replace(/\s+/g,'').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z]+|[()+\-*/^,]/g)||[];
  if(tokens.join('')!==source.replace(/\s+/g,'')) throw Error('Ký tự không hợp lệ');
  let i=0,depth=0;
  const funcs={sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp};
  const number=()=>{
    if(++depth>80) throw Error('Biểu thức lồng quá sâu');
    const t=tokens[i++];let fn;
    if(t==='('){fn=sum();if(tokens[i++]!==')')throw Error('Thiếu dấu )');}
    else if(t==='x'||t==='a')fn=(x,a)=>t==='x'?x:a;
    else if(t==='pi'||t==='e')fn=()=>t==='pi'?Math.PI:Math.E;
    else if(Object.hasOwn(funcs,t)){if(tokens[i++]!=='(')throw Error('Hàm cần dấu (');const arg=sum();if(tokens[i++]!==')')throw Error('Thiếu dấu )');fn=(x,a)=>funcs[t](arg(x,a));}
    else if(t&&Number.isFinite(Number(t)))fn=()=>Number(t);
    else throw Error('Chỉ hỗ trợ x, a, pi, e và sin/cos/tan/sqrt/abs/ln/log/exp');
    depth--;return fn;
  };
  const power=()=>{const left=number();if(tokens[i]==='^'){i++;const right=unary();return(x,a)=>left(x,a)**right(x,a);}return left;};
  const unary=()=>{if(tokens[i]==='+'||tokens[i]==='-'){const sign=tokens[i++];const arg=unary();return(x,a)=>sign==='-'?-arg(x,a):arg(x,a);}return power();};
  const product=()=>{let left=unary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],right=unary(),old=left;left=(x,a)=>op==='*'?old(x,a)*right(x,a):old(x,a)/right(x,a);}return left;};
  const sum=()=>{let left=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],right=product(),old=left;left=(x,a)=>op==='+'?old(x,a)+right(x,a):old(x,a)-right(x,a);}return left;};
  const fn=sum();if(i!==tokens.length)throw Error('Biểu thức chưa đúng; dùng * để nhân');return(x,a=1)=>{const result=fn(x,a);return Number.isFinite(result)?result:NaN;};
}

// Multi-param version: compileExpressionP accepts arbitrary named params from a dict.
// The compiled closure takes (x, params) where params = { a: 1, b: 2, ... }
export function compileExpressionP(source) {
  if(typeof source!=='string'||source.length>300) throw Error('Biểu thức quá dài');
  const tokens=source.replace(/\s+/g,'').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z]+|[()+-\/*^,]/g)||[];
  if(tokens.join('')!==source.replace(/\s+/g,'')) throw Error('Ký tự không hợp lệ');
  let i=0,depth=0;
  const funcs={sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,abs:Math.abs,ln:Math.log,log:Math.log10,exp:Math.exp};
  const number=()=>{
    if(++depth>80) throw Error('Biểu thức lồng quá sâu');
    const t=tokens[i++];let fn;
    if(t==='('){fn=sum();if(tokens[i++]!==')')throw Error('Thiếu dấu )');}
    else if(t==='x')fn=(x,p)=>x;
    else if(t==='pi'||t==='e')fn=()=>t==='pi'?Math.PI:Math.E;
    else if(Object.hasOwn(funcs,t)){if(tokens[i++]!=='(')throw Error('Hàm cần dấu (');const arg=sum();if(tokens[i++]!==')')throw Error('Thiếu dấu )');fn=(x,p)=>funcs[t](arg(x,p));}
    else if(t&&Number.isFinite(Number(t)))fn=()=>Number(t);
    else if(t&&/^[a-z]$/.test(t))fn=(x,p)=>p!=null&&Object.hasOwn(p,t)?p[t]:NaN;  // named param
    else throw Error('Chỉ hỗ trợ x, các tham số a-z, pi, e và sin/cos/tan/sqrt/abs/ln/log/exp');
    depth--;return fn;
  };
  const power=()=>{const left=number();if(tokens[i]==='^'){i++;const right=unary();return(x,p)=>left(x,p)**right(x,p);}return left;};
  const unary=()=>{if(tokens[i]==='+'||tokens[i]==='-'){const sign=tokens[i++];const arg=unary();return(x,p)=>sign==='-'?-arg(x,p):arg(x,p);}return power();};
  const product=()=>{let left=unary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],right=unary(),old=left;left=(x,p)=>op==='*'?old(x,p)*right(x,p):old(x,p)/right(x,p);}return left;};
  const sum=()=>{let left=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],right=product(),old=left;left=(x,p)=>op==='+'?old(x,p)+right(x,p):old(x,p)-right(x,p);}return left;};
  const fn=sum();if(i!==tokens.length)throw Error('Biểu thức chưa đúng; dùng * để nhân');
  return(x,params={})=>{const result=fn(x,params);return Number.isFinite(result)?result:NaN;};
}

// Convenience: evaluate source at (x, params) — throws on parse error, returns NaN on domain error
export function evaluateExpression(source, x, params = {}) {
  return compileExpressionP(source)(x, params);
}

export function detectExpressionType(source) {
  if (/[<>]=?/.test(source)) return 'inequality';
  if (source.includes('=')) {
    const lhs = source.split('=')[0].trim();
    if (lhs === 'y') return 'explicit';
    return 'implicit';
  }
  return 'explicit';
}

export function normalizeToLHS(source) {
  let op = '=';
  let expr = source;
  const match = source.match(/(=|[<>]=?)/);
  if (match) {
    op = match[1];
    const parts = source.split(match[0]);
    // Remove 'y =' if explicit
    if (op === '=' && parts[0].trim() === 'y') {
      expr = parts[1];
    } else {
      expr = '(' + parts[0] + ') - (' + parts[1] + ')';
    }
  }
  return { lhs: expr, op };
}

export function exprToLatex(src) {
  if (!src || !src.trim()) return '';
  return src
    .replace(/\^([^\s\+\-\*\/\(\)]+)/g, '^{$1}')
    .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/abs\(([^)]+)\)/g, '|$1|')
    .replace(/\b(sin|cos|tan|ln|log|exp)\b/g, '\\$1')
    .replace(/(?<!\*)\*(?!\*)/g, ' \\cdot ')
    .replace(/\bpi\b/gi, '\\pi')
    .replace(/\btheta\b/gi, '\\theta')
    .replace(/\balpha\b/gi, '\\alpha');
}
