import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:papyrus/app/di/providers.dart';
import 'package:papyrus/features/question_sets/domain/entities/question_set.dart';

final questionSetsProvider = StreamProvider<List<QuestionSet>>((ref) {
  return ref.watch(questionSetRepositoryProvider).watchAll();
});

final questionSetProvider = FutureProvider.family<QuestionSet?, String>(
  (ref, id) => ref.watch(questionSetRepositoryProvider).findById(id),
);
