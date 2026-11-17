import { supabase } from '@/core/network/supabase';
import { cloudSets } from '@/features/sync/data/cloudSets';
import { deleteAccount } from '../domain/deleteAccount';
import { eraseLocalData } from './eraseLocalData';

export async function deleteCurrentAccount() {
  if(!supabase)throw new Error('Sign in to delete your account.');
  const {data}=await supabase.auth.getSession();
  const owner=data.session?.user.id;
  if(!owner)throw new Error('Sign in again to delete your account.');
  return deleteAccount({
    async removeRemote(){
      const {data,error}=await supabase!.functions.invoke('delete-account',{body:{confirmation:'DELETE'}});
      if(error || !data?.deleted)throw new Error('Could not delete the account. Check your connection or contact support. Your data has not been cleared on this device.');
    },
    async clearSession(){const {error}=await supabase!.auth.signOut({scope:'local'});if(error)throw error;},
    async eraseDevice(){await cloudSets.clearAccountCache(owner);await eraseLocalData(owner);},
  });
}
