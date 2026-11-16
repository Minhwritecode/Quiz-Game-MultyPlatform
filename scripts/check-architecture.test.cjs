const {test}=require('node:test');const assert=require('node:assert/strict');
const {imports,check}=require('./check-architecture.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('extracts import, export, require, dynamic import and type import',()=>{
 assert.deepEqual(imports(`import x from 'a';export {x} from 'b';const c=require('c');import('d');type T=import('e').T;import(variable);`),['a','b','c','d','e','<dynamic>']);
});
function fixture(files,run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'papyrus-arch-'));try{fs.writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{paths:{'@/*':['./src/*']}}}));for(const [name,content] of Object.entries(files)){const file=path.join(dir,'src',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}run(check(dir));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('rejects infrastructure hidden behind relative and alias barrels',()=>fixture({'app/screen.ts':`import {x} from '@/helpers';`,'helpers.ts':`export {x} from './features/a/data/store';`,'features/a/data/store.ts':'export const x=1;'},errors=>assert.equal(errors.length,1)));
test('rejects domain framework, data-to-UI, require and computed imports',()=>fixture({'features/a/domain/a.ts':`import 'react';`,'features/a/data/a.ts':`import '../../a/presentation/view';`,'features/a/presentation/view.ts':`require('@react-native-async-storage/async-storage');import(name);`},errors=>assert.ok(errors.length>=4)));
test('allows composition injection and pure contracts',()=>fixture({'app/view.ts':`import {x} from '@/composition/root';import type {T} from '@/features/a/domain/types';`,'composition/root.ts':`export {x} from '../features/a/data/store';`,'features/a/data/store.ts':'export const x=1;','features/a/domain/types.ts':'export type T=string;'},errors=>assert.deepEqual(errors,[])));

test('rejects direct network and browser storage access',()=>{
 for(const source of ["fetch('/api');", "globalThis.fetch('/api');", "localStorage.getItem('token');"]){
  fixture({'app/view.ts':source},errors=>assert.equal(errors.length,1));
 }
});
