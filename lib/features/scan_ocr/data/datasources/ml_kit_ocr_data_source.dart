import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import 'package:papyrus/features/scan_ocr/domain/entities/source_document.dart';

class MlKitOcrDataSource {
  MlKitOcrDataSource({TextRecognizer? recognizer})
    : _recognizer =
          recognizer ?? TextRecognizer(script: TextRecognitionScript.latin);

  final TextRecognizer _recognizer;

  Future<SourceDocument> extractText(String imagePath) async {
    final result = await _recognizer.processImage(
      InputImage.fromFilePath(imagePath),
    );
    return SourceDocument(
      id: imagePath,
      title: 'Scanned material',
      text: result.text,
      createdAt: DateTime.now(),
    );
  }

  Future<void> close() => _recognizer.close();
}
