import { needsUpgrade, recordCompletion } from './policy';
test('compares numeric versions, never locks users out for malformed policy or unsafe link', () => {
  const policy={minimumVersion:'1.10.0',storeUrl:'https://play.google.com/store/apps/details?id=com.papyrus.quizclash'};
  expect(needsUpgrade('1.9.9',policy)).toBe(true);
  expect(needsUpgrade('2.0.0',policy)).toBe(false);
  expect(needsUpgrade('1.10.0',policy)).toBe(false);
  expect(needsUpgrade('0.2.0',{...policy,minimumVersion:'broken'})).toBe(false);
  expect(needsUpgrade('0.2.0',{...policy,storeUrl:'https://evil.test'})).toBe(false);
});
test('review prompts require five distinct completions, seven days and cooldown', () => {
  const day=86400000, history={firstUsed:0,completed:['1','2','3','4']};
  expect(recordCompletion(history,'5',day).eligible).toBe(false);
  expect(recordCompletion(history,'4',8*day).eligible).toBe(false);
  expect(recordCompletion(history,'5',8*day).eligible).toBe(true);
  expect(recordCompletion({...history,lastPrompt:7*day},'5',8*day).eligible).toBe(false);
});
