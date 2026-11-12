import * as Notifications from 'expo-notifications';
import { reminders } from './reminders.native';
jest.mock('expo-notifications',()=>({
 getPermissionsAsync:jest.fn(),requestPermissionsAsync:jest.fn(),
 setNotificationChannelAsync:jest.fn(),scheduleNotificationAsync:jest.fn(),cancelScheduledNotificationAsync:jest.fn(),
 SchedulableTriggerInputTypes:{DAILY:'daily'},AndroidImportance:{DEFAULT:3},
}));
beforeEach(()=>jest.clearAllMocks());
test('refused permission never schedules a reminder',async()=>{
 (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({granted:false,canAskAgain:false});
 await expect(reminders.setEnabled(true)).rejects.toThrow('quyền');
 expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
 expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
test('turning off only cancels the study reminder',async()=>{
 await reminders.setEnabled(false);
 expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('papyrus-study-reminder');
 expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
});
test('schedules a private daily reminder with a stable identifier',async()=>{
 (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({granted:true});
 await reminders.setEnabled(true);
 expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({identifier:'papyrus-study-reminder',trigger:expect.objectContaining({hour:19,minute:0,type:'daily'})}));
});
