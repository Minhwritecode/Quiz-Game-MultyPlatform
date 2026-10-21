import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:papyrus/core/config/app_config.dart';
import 'package:papyrus/features/question_sets/data/repositories/in_memory_question_set_repository.dart';
import 'package:papyrus/features/question_sets/domain/repositories/question_set_repository.dart';

final appConfigProvider = Provider<AppConfig>(
  (ref) => AppConfig.fromEnvironment(),
);

final questionSetRepositoryProvider = Provider<QuestionSetRepository>(
  (ref) => InMemoryQuestionSetRepository.seeded(),
);
