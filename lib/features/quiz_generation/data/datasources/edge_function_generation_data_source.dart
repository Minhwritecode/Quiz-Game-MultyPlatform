import 'dart:convert';

import 'package:papyrus/features/quiz_generation/domain/entities/generation_request.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class EdgeFunctionGenerationDataSource {
  const EdgeFunctionGenerationDataSource(this.client);

  final SupabaseClient client;

  Future<String> request(GenerationRequest request) async {
    final response = await client.functions.invoke(
      'generate-questions',
      body: {
        'source_text': request.sourceText,
        'question_count': request.questionCount,
        'difficulty': request.difficulty.name,
        'language': request.languageCode,
      },
    );
    return response.data is String
        ? response.data as String
        : jsonEncode(response.data);
  }
}
