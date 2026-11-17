import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ReleaseGate } from './ReleaseGate';
import { dependencies } from '@/composition/dependencies';
jest.mock('@/composition/dependencies',()=>({dependencies:{release:{requiredUpgrade:jest.fn(),initializeReview:jest.fn().mockResolvedValue(undefined)}}}));
jest.mock('./ui',()=>{
  const {Text:MockText}=jest.requireActual('react-native');
  return {Screen:({children}:any)=>children,Card:({children}:any)=>children,Button:({children}:any)=><MockText>{children}</MockText>};
});
test('offline policy failure keeps the study screen available',async()=>{
  (dependencies.release.requiredUpgrade as jest.Mock).mockResolvedValue(null);
  await render(<ReleaseGate><Text>Study</Text></ReleaseGate>);
  expect(screen.getByText('Study')).toBeTruthy();
});
test('valid mandatory upgrade replaces the protected screen',async()=>{
  (dependencies.release.requiredUpgrade as jest.Mock).mockResolvedValue({minimumVersion:'1.0.0',storeUrl:'https://play.google.com/store/apps/details?id=test'});
  await render(<ReleaseGate><Text>Study</Text></ReleaseGate>);
  await waitFor(()=>expect(screen.getByText('Cần cập nhật Papyrus / Update required')).toBeTruthy());
  expect(screen.queryByText('Study')).toBeNull();
});
