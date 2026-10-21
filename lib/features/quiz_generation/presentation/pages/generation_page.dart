import 'package:flutter/material.dart';

import 'package:papyrus/core/theme/app_tokens.dart';
import 'package:papyrus/core/widgets/papyrus_ui.dart';

class GenerationPage extends StatefulWidget {
  const GenerationPage({super.key});

  @override
  State<GenerationPage> createState() => _GenerationPageState();
}

class _GenerationPageState extends State<GenerationPage> {
  double _count = 10;
  String _difficulty = 'Medium';
  String _language = 'Vietnamese';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shape your quiz')),
      body: PapyrusPage(
        child: ListView(
          children: [
            const PapyrusHeader(
              eyebrow: 'Step 2 of 3 · Shape',
              title: 'Choose the right challenge',
              subtitle: 'Generation is streamed, validated and kept editable until you save the set.',
            ),
            const SizedBox(height: 24),
            LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 760;
                final controls = PapyrusCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Question count',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${_count.round()} questions',
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                            ),
                      ),
                      Slider(
                        value: _count,
                        min: 5,
                        max: 30,
                        divisions: 25,
                        label: _count.round().toString(),
                        onChanged: (value) => setState(() => _count = value),
                      ),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        initialValue: _difficulty,
                        decoration: const InputDecoration(
                          labelText: 'Difficulty',
                          prefixIcon: Icon(Icons.tune_outlined),
                        ),
                        items: ['Easy', 'Medium', 'Hard']
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _difficulty = value ?? _difficulty),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _language,
                        decoration: const InputDecoration(
                          labelText: 'Question language',
                          prefixIcon: Icon(Icons.translate_outlined),
                        ),
                        items: ['Vietnamese', 'English']
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) =>
                            setState(() => _language = value ?? _language),
                      ),
                    ],
                  ),
                );
                final preview = PapyrusCard(
                  color: PapyrusTokens.indigoTint,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: Theme.of(context)
                                .colorScheme
                                .primary,
                            foregroundColor: Theme.of(context)
                                .colorScheme
                                .onPrimary,
                            child: const Icon(Icons.auto_awesome_rounded),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Generation preview',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Your quiz will include a balanced mix of recall, understanding and application prompts.',
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          PapyrusTag(
                            '${_count.round()} questions',
                            icon: Icons.format_list_numbered_rounded,
                            tone: PapyrusTagTone.primary,
                          ),
                          PapyrusTag(
                            _difficulty,
                            icon: Icons.speed_outlined,
                            tone: PapyrusTagTone.reward,
                          ),
                          PapyrusTag(
                            _language,
                            icon: Icons.translate_outlined,
                            tone: PapyrusTagTone.success,
                          ),
                        ],
                      ),
                    ],
                  ),
                );
                return wide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: controls),
                          const SizedBox(width: 20),
                          Expanded(child: preview),
                        ],
                      )
                    : Column(
                        children: [
                          controls,
                          const SizedBox(height: 16),
                          preview,
                        ],
                      );
              },
            ),
            const SizedBox(height: 20),
            PapyrusCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Quality gate\nEvery streamed object is checked for four distinct options, a valid answer index and an explanation before it reaches review.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            PapyrusPrimaryButton(
              label: 'Start streaming generation',
              icon: Icons.auto_awesome_outlined,
              onPressed: () => _showMessage(
                'Generation provider adapter is ready for the next vertical slice.',
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
}
