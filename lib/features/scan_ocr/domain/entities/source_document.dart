class SourceDocument {
  const SourceDocument({
    required this.id,
    required this.title,
    required this.text,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String text;
  final DateTime createdAt;
}
