export async function readCloudState(_key:string):Promise<string|null>{throw new Error('A platform storage adapter is required.');}
export async function writeCloudState(_key:string,_value:string):Promise<void>{throw new Error('A platform storage adapter is required.');}
