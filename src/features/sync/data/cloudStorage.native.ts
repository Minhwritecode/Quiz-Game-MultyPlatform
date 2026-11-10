import {getLocalDatabase} from '@/core/database/sqlite.native';
export async function readCloudState(key:string):Promise<string|null>{
 const db=getLocalDatabase();
 db.execSync('CREATE TABLE IF NOT EXISTS account_sync_state (owner TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL)');
 return db.getFirstSync<{state:string}>('SELECT state FROM account_sync_state WHERE owner=?',key)?.state??null;
}
export async function writeCloudState(key:string,value:string):Promise<void>{
 const db=getLocalDatabase();
 db.execSync('CREATE TABLE IF NOT EXISTS account_sync_state (owner TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL)');
 db.runSync('INSERT INTO account_sync_state(owner,state) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET state=excluded.state',key,value);
}
