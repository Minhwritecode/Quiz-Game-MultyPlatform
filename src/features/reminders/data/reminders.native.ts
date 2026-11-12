import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
const identifier='papyrus-study-reminder';
export const reminders={
 listen(onOpen:()=>void){
  let active=true;
  const open=(response:Notifications.NotificationResponse|null)=>{if(active && response?.notification.request.identifier===identifier){onOpen();void Notifications.clearLastNotificationResponseAsync().catch(()=>undefined);}};
  const subscription=Notifications.addNotificationResponseReceivedListener(open);
  void Notifications.getLastNotificationResponseAsync().then(open).catch(()=>undefined);
  return ()=>{active=false;subscription.remove();};
 },
 async enabled(){return (await Notifications.getAllScheduledNotificationsAsync()).some(n=>n.identifier===identifier);},
 async setEnabled(enabled:boolean,hour=19,minute=0){
  if(!enabled){await Notifications.cancelScheduledNotificationAsync(identifier);return;}
  if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)throw new Error('Giờ nhắc không hợp lệ.');
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('study',{name:'Nhắc ôn tập',importance:AndroidImportance.DEFAULT});
  let permission=await Notifications.getPermissionsAsync();
  if(!permission.granted && permission.canAskAgain)permission=await Notifications.requestPermissionsAsync();
  if(!permission.granted)throw new Error('Chưa có quyền thông báo. Bạn có thể bật quyền trong cài đặt điện thoại.');
  await Notifications.scheduleNotificationAsync({identifier,content:{title:'Một chút thời gian cho việc học',body:'Mở Papyrus và ôn lại một bộ câu hỏi khi bạn sẵn sàng.',data:{route:'/sets'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute,channelId:'study'}});
 },
};
