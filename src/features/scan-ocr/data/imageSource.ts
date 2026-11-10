import * as ImagePicker from 'expo-image-picker';

export async function pickSourceImages(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.9 });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri);
}

export async function captureSourceImage(): Promise<string[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Allow camera access in Settings, or choose photos/paste notes instead.');
  const result = await ImagePicker.launchCameraAsync({mediaTypes: ['images'], quality: 0.9});
  return result.canceled ? [] : result.assets.map(asset => asset.uri);
}
