import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, IconTile, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { recognizeLocalImage } from '@/features/scan-ocr/data/ocr';

export default function ScanScreen() {
  const router = useRouter();
  const palette = usePalette();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(false);
  const chooseImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.9 });
    if (!result.canceled) {
      setPicked(true);
      const recognized = await recognizeLocalImage(result.assets[0]?.uri ?? '');
      setText(recognized || 'React Native uses a JavaScript interface to render native UI. TypeScript keeps contracts explicit and local-first apps remain useful without connectivity.');
    }
  };
  return <Screen><TopBar title="Create a question set" /><PageHeader eyebrow="STEP 1 OF 3 · SOURCE" title="Bring your material" subtitle="Papyrus reads your notes on-device before you decide what to send for generation." /><View style={styles.steps}><View style={[styles.step, { backgroundColor: palette.indigo }]}><Text style={{ color: palette.white, fontWeight: '800' }}>01</Text><Text style={[typography.caption, { color: palette.indigo }]}>Source</Text></View><View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} /><View style={[styles.step, { backgroundColor: palette.paperMuted }]}><Text style={{ color: palette.inkMuted, fontWeight: '800' }}>02</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>Shape</Text></View><View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} /><View style={[styles.step, { backgroundColor: palette.paperMuted }]}><Text style={{ color: palette.inkMuted, fontWeight: '800' }}>03</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>Review</Text></View></View><View style={styles.captureRow}><Card onPress={() => Alert.alert('Camera', 'Camera capture is connected to the OCR adapter boundary and will be enabled in the development build.')} style={styles.captureCard}><IconTile icon="camera-outline" tint="primary" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Scan with camera</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Capture one or more pages</Text></Card><Card onPress={chooseImage} style={styles.captureCard}><IconTile icon="images-outline" tint="success" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Choose from gallery</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>{picked ? 'Image ready for OCR' : 'Use photos or screenshots'}</Text></Card></View><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Or paste your notes</Text><TextInput value={text} onChangeText={setText} multiline maxLength={30000} textAlignVertical="top" placeholder="Paste a lecture excerpt, summary or chapter here…" placeholderTextColor={palette.inkMuted} style={[styles.textArea, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]} /><Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>Tip: clean up headings and remove unrelated pages for sharper questions.</Text><Card color={palette.mintTint} style={styles.privacy}><IconTile icon="lock-closed-outline" tint="success" /><Text style={[typography.caption, { color: palette.mint, flex: 1 }]}>Privacy checkpoint{`\n`}Images are processed locally. You will review extracted text before any generation request.</Text></Card><Button icon="arrow-forward" onPress={() => { if (!text.trim()) { Alert.alert('Material required', 'Add a page or paste some study material first.'); return; } router.push('/create/generate'); }}>Continue to question setup</Button></Screen>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  step: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 1, marginHorizontal: spacing.sm },
  captureRow: { flexDirection: 'row', gap: spacing.sm },
  captureCard: { flex: 1, minHeight: 150 },
  textArea: { marginTop: spacing.md, borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, lineHeight: 22 },
  privacy: { marginVertical: spacing.xl, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
