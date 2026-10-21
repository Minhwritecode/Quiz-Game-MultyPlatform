import 'package:papyrus/features/scan_ocr/data/datasources/ml_kit_ocr_data_source.dart';
import 'package:papyrus/features/scan_ocr/domain/entities/source_document.dart';
import 'package:papyrus/features/scan_ocr/domain/repositories/ocr_repository.dart';

class OcrRepositoryImpl implements OcrRepository {
  const OcrRepositoryImpl(this.dataSource);

  final MlKitOcrDataSource dataSource;

  @override
  Future<SourceDocument> extractTextFromImage(String imagePath) =>
      dataSource.extractText(imagePath);
}
