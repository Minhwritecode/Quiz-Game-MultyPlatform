import 'dart:async';

import 'package:papyrus/features/sync/domain/entities/sync_item.dart';

/// Coordinates local-first writes with ordered push and cursor-based pull.
/// The concrete Drift/Supabase adapters are intentionally injected later.
class SyncEngine {
  SyncEngine({required this.push, required this.pull});

  final Future<void> Function(SyncItem item) push;
  final Future<void> Function(DateTime? updatedAfter) pull;

  bool _running = false;

  Future<void> runOnce(List<SyncItem> queue, DateTime? cursor) async {
    if (_running) return;
    _running = true;
    try {
      for (final item
          in queue..sort((a, b) => a.createdAt.compareTo(b.createdAt))) {
        await push(item);
      }
      await pull(cursor);
    } finally {
      _running = false;
    }
  }
}
