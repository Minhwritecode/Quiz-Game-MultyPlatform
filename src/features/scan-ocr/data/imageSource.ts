import * as ImagePicker from 'expo-image-picker';

export async function pickSourceImages(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.9 });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri);
}
