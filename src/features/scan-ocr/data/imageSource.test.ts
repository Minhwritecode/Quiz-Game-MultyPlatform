import * as ImagePicker from 'expo-image-picker';
import { captureSourceImage } from './imageSource';
jest.mock('expo-image-picker',()=>({requestCameraPermissionsAsync:jest.fn(),launchCameraAsync:jest.fn()}));

describe('camera intake',()=>{
  beforeEach(()=>jest.resetAllMocks());
  it('does not open the camera after permission denial',async()=>{
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({granted:false} as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);
    await expect(captureSourceImage()).rejects.toThrow('Allow camera access');
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
  it('returns no page when the learner cancels capture',async()=>{
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({granted:true} as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({canceled:true,assets:null});
    await expect(captureSourceImage()).resolves.toEqual([]);
  });
});
