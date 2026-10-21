enum SyncOperation { insert, update, delete }

class SyncItem {
  const SyncItem({
    required this.id,
    required this.entity,
    required this.entityId,
    required this.operation,
    required this.payload,
    required this.createdAt,
    this.retryCount = 0,
  });

  final int id;
  final String entity;
  final String entityId;
  final SyncOperation operation;
  final Map<String, Object?> payload;
  final DateTime createdAt;
  final int retryCount;
}
