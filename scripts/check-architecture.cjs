const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const norm=p=>p.replaceAll('\\','/');
function layer(file){
 const p=norm(file);
 if(p.includes('/composition/'))return 'composition';
 if(p.includes('/domain/'))return 'domain';
 if(/\/(data|network|database)\//.test(p))return 'data';
 if(/\/(app|shared|presentation)\//.test(p)||p.includes('/core/state/'))return 'presentation';
 return 'other';
}
function imports(source,file='source.ts'){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const result=[];
 function visit(node){
  if(ts.isCallExpression(node) && /^(fetch|globalThis\.fetch|window\.fetch|localStorage\.[a-zA-Z]+|sessionStorage\.[a-zA-Z]+)$/.test(node.expression.getText(tree)))result.push('<direct-io>');
  const spec=(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))?node.moduleSpecifier:ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)?node.moduleReference.expression:ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(tree)==='require')?node.arguments[0]:ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)?node.argument.literal:null;
  if(spec){if(ts.isStringLiteralLike(spec))result.push(spec.text);else result.push('<dynamic>');}
  ts.forEachChild(node,visit);
 }visit(tree);return result;
}
const infra=/^(?:@supabase\/|@react-native-async-storage\/|@react-native-ml-kit\/|expo-(?:sqlite|file-system|document-picker|image-picker|secure-store)|expo\/fetch|node:|axios(?:\/|$)|fs$)/;
function forbidden(from,to,spec){
 if(from==='domain')return to ? layer(to)!=='domain' : spec!=='zod';
 if(from==='presentation')return (to && layer(to)==='data') || infra.test(spec) || ['<dynamic>','<direct-io>'].includes(spec);
 if(from==='data')return to && ['presentation','composition'].includes(layer(to));
 return false;
}
function check(projectRoot=root){
 const files=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory()){if(!['skills','node_modules'].includes(entry.name))walk(full);}else if(/\.[cm]?[jt]sx?$/.test(full)&&!full.endsWith('.d.ts')&&!/\.(test|spec)\./.test(full))files.push(full);}}
 walk(path.join(projectRoot,'src'));
 const config=ts.readConfigFile(path.join(projectRoot,'tsconfig.json'),ts.sys.readFile);
 const options=ts.parseJsonConfigFileContent(config.config,ts.sys,projectRoot).options;
 const graph=new Map(files.map(f=>[f,imports(fs.readFileSync(f,'utf8'),f).map(spec=>({spec,to:ts.resolveModuleName(spec,f,options,ts.sys).resolvedModule?.resolvedFileName})).map(e=>({...e,to:e.to&&!e.to.includes('/node_modules/')?path.resolve(e.to):undefined}))]));
 const errors=[];
 for(const file of files){const origin=layer(file);if(!['domain','data','presentation'].includes(origin))continue;
  const visited=new Set();
  function follow(current,chain){if(visited.has(current))return;visited.add(current);
   for(const edge of graph.get(current)||[]){
    if(forbidden(origin,edge.to,edge.spec)){errors.push(`${norm(path.relative(projectRoot,file))}: ${[...chain,edge.spec].join(' -> ')}`);continue;}
    if(edge.to && layer(edge.to)!=='composition')follow(edge.to,[...chain,edge.spec]);
   }
  }follow(file,[]);
 }
 return [...new Set(errors)];
}
module.exports={imports,layer,forbidden,check};
if(require.main===module){const errors=check();if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Architecture graph check passed.');}
