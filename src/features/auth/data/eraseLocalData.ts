import { AppError } from '@/core/domain/failure';
export async function eraseLocalData(_owner:string):Promise<void> {throw new AppError('unavailable', 'Platform adapter required.');}
