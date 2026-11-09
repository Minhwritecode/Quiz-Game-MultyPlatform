import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, IconTile, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { createSourceDocument } from '@/features/scan-ocr/domain/sourceDocument';
import { pickSourceImages } from '@/features/scan-ocr/data/imageSource';
import { recognizeLocalImage } from '@/features/scan-ocr/data/ocr';

export default function ScanScreen() {
  const router = useRouter();
  const palette = usePalette();
  const saveSourceDocument = usePapyrusStore((state) => state.saveSourceDocument);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const chooseImage = async () => {
    setBusy(true);
    try {
      const images = await pickSourceImages();
      if (images.length === 0) return;
      const extracted = (await Promise.all(images.map((uri) => recognizeLocalImage(uri))))
        .map((value) => value.trim())
        .filter(Boolean)
        .join('\n\n');
      setPicked(true);
      if (extracted) setText((current) => [current.trim(), extracted].filter(Boolean).join('\n\n'));
      else Alert.alert('Text not detected', 'OCR is unavailable for this platform or the image has no readable text. You can paste the notes manually.');
    } catch (error) {
      Alert.alert('Could not read images', error instanceof Error ? error.message : 'Please choose the images again.');
    } finally {
      setBusy(false);
    }
  };
  const continueToShape = () => {
    const sourceText = text.trim();
    if (!sourceText) {
      Alert.alert('Material required', 'Add a page or paste some study material first.');
      return;
    }
    saveSourceDocument(createSourceDocument(`source-${Date.now()}`, sourceText));
    router.push('/create/generate');
  };
  return <Screen><TopBar title="Create a question set" /><PageHeader eyebrow="STEP 1 OF 3 · SOURCE" title="Bring your material" subtitle="Papyrus reads your notes on-device before you decide what to send for generation." /><View style={styles.steps}><View style={[styles.step, { backgroundColor: palette.indigo }]}><Text style={{ color: palette.white, fontWeight: '800' }}>01</Text><Text style={[typography.caption, { color: palette.indigo }]}>Source</Text></View><View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} /><View style={[styles.step, { backgroundColor: palette.paperMuted }]}><Text style={{ color: palette.inkMuted, fontWeight: '800' }}>02</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>Shape</Text></View><View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} /><View style={[styles.step, { backgroundColor: palette.paperMuted }]}><Text style={{ color: palette.inkMuted, fontWeight: '800' }}>03</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>Review</Text></View></View><View style={styles.captureRow}><Card onPress={() => Alert.alert('Camera', 'Camera capture is connected to the OCR adapter boundary and will be enabled in the development build.')} style={styles.captureCard}><IconTile icon="camera-outline" tint="primary" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Scan with camera</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Capture one or more pages</Text></Card><Card onPress={() => void chooseImage()} style={styles.captureCard}><IconTile icon="images-outline" tint="success" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Choose from gallery</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>{busy ? 'Reading images…' : picked ? 'Image ready for OCR' : 'Use photos or screenshots'}</Text></Card></View><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Or paste your notes</Text><TextInput value={text} onChangeText={setText} multiline maxLength={30000} textAlignVertical="top" placeholder="Paste a lecture excerpt, summary or chapter here…" placeholderTextColor={palette.inkMuted} style={[styles.textArea, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]} /><Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>{text.length.toLocaleString()} / 30,000 characters · Clean up headings for sharper questions.</Text><Card color={palette.mintTint} style={styles.privacy}><IconTile icon="lock-closed-outline" tint="success" /><Text style={[typography.caption, { color: palette.mint, flex: 1 }]}>Privacy checkpoint{`\n`}Images are processed locally. You will review extracted text before any generation request.</Text></Card><Button disabled={busy} icon="arrow-forward" onPress={continueToShape}>{busy ? 'Reading material…' : 'Continue to question setup'}</Button></Screen>;
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
