import 'package:papyrus/features/scan_ocr/domain/entities/source_document.dart';

abstract interface class OcrRepository {
  Future<SourceDocument> extractTextFromImage(String imagePath);
}
