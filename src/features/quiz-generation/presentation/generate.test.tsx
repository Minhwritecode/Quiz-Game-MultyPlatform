import { render, screen, fireEvent } from '@testing-library/react-native';
import GenerateScreen from '@/app/create/generate';
import { dependencies } from '@/composition/dependencies';
jest.mock('expo-router',()=>({useRouter:()=>({replace:jest.fn()})}));
jest.mock('@expo/vector-icons',()=>({Ionicons:()=>null}));
jest.mock('@/composition/dependencies',()=>({dependencies:{generation:{configured:false,generate:jest.fn()},questionSets:{save:jest.fn()}}}));
jest.mock('@/shared/ui',()=>{
  const {Text:MockText,Pressable:MockPressable}=jest.requireActual('react-native');
  return {Screen:({children}:any)=>children,Card:({children}:any)=>children,TopBar:()=>null,PageHeader:()=>null,usePalette:()=>({}),Button:({children,onPress,disabled}:any)=><MockPressable accessibilityRole="button" disabled={disabled} onPress={onPress}><MockText>{children}</MockText></MockPressable>};
});
test('generation screen starts empty and cannot save canned sample questions',async()=>{
  await render(<GenerateScreen/>);
  expect(screen.queryByText('QUESTION 1')).toBeNull();
  await fireEvent.press(screen.getByText('Save question set'));
  expect(dependencies.questionSets.save).not.toHaveBeenCalled();
});
test('manual authoring is available without AI but rejects an untitled set',async()=>{
  await render(<GenerateScreen/>);
  await fireEvent.press(screen.getByText('Add a question manually'));
  expect(screen.getByText('QUESTION 1')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save question set'));
  expect(screen.getByText('Enter a title for your question set.')).toBeTruthy();
  expect(dependencies.questionSets.save).not.toHaveBeenCalled();
});
