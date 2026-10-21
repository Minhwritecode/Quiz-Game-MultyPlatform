import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:papyrus/core/theme/app_tokens.dart';
import 'package:papyrus/core/widgets/papyrus_ui.dart';

class ScanPage extends StatefulWidget {
  const ScanPage({super.key});

  @override
  State<ScanPage> createState() => _ScanPageState();
}

class _ScanPageState extends State<ScanPage> {
  final _textController = TextEditingController();
  final int _step = 0;

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create a question set')),
      body: PapyrusPage(
        child: ListView(
          children: [
            const PapyrusHeader(
              eyebrow: 'Step 1 of 3 · Source',
              title: 'Bring your material',
              subtitle: 'Papyrus reads your notes on-device before you decide what to send for generation.',
            ),
            const SizedBox(height: 24),
            _StepIndicator(current: _step),
            const SizedBox(height: 24),
            LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 760;
                final capture = Column(
                  children: [
                    _CaptureOption(
                      icon: Icons.camera_alt_outlined,
                      title: 'Scan with camera',
                      description: 'Capture one or more pages',
                      onTap: () => _showMessage(
                        'Camera entry is ready for the ML Kit vertical slice.',
                      ),
                    ),
                    const SizedBox(height: 12),
                    _CaptureOption(
                      icon: Icons.photo_library_outlined,
                      title: 'Choose from gallery',
                      description: 'Use photos or screenshots',
                      onTap: () => _showMessage(
                        'Gallery entry is ready for the ML Kit vertical slice.',
                      ),
                    ),
                  ],
                );
                final paste = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Or paste your notes',
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _textController,
                      minLines: 6,
                      maxLines: 10,
                      maxLength: 30000,
                      decoration: const InputDecoration(
                        hintText:
                            'Paste a lecture excerpt, summary or chapter here…',
                        alignLabelWithHint: true,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Tip: clean up headings and remove unrelated pages for sharper questions.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                );
                return wide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: capture),
                          const SizedBox(width: 20),
                          Expanded(child: paste),
                        ],
                      )
                    : Column(
                        children: [capture, const SizedBox(height: 24), paste],
                      );
              },
            ),
            const SizedBox(height: 20),
            PapyrusCard(
              color: PapyrusTokens.mintTint,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lock_outline, color: PapyrusTokens.mint),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Privacy checkpoint\nImages are processed locally. You will review extracted text before any generation request.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: PapyrusTokens.mint,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            PapyrusPrimaryButton(
              label: 'Continue to question setup',
              icon: Icons.arrow_forward_rounded,
              onPressed: () {
                if (_textController.text.trim().isEmpty) {
                  _showMessage(
                    'Add a page or paste some study material first.',
                  );
                  return;
                }
                context.push('/create/generate');
              },
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

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.current});

  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Step(number: '01', label: 'Source', active: current >= 0),
        Expanded(
          child: Divider(color: Theme.of(context).colorScheme.outlineVariant),
        ),
        _Step(number: '02', label: 'Shape', active: current >= 1),
        Expanded(
          child: Divider(color: Theme.of(context).colorScheme.outlineVariant),
        ),
        _Step(number: '03', label: 'Review', active: current >= 2),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.number,
    required this.label,
    required this.active,
  });

  final String number;
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      CircleAvatar(
        radius: 18,
        backgroundColor: active
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        foregroundColor: active
            ? Theme.of(context).colorScheme.onPrimary
            : Theme.of(context).colorScheme.onSurfaceVariant,
        child: Text(
          number,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
        ),
      ),
      const SizedBox(height: 5),
      Text(label, style: Theme.of(context).textTheme.labelSmall),
    ],
  );
}

class _CaptureOption extends StatelessWidget {
  const _CaptureOption({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => PapyrusCard(
    onTap: onTap,
    child: Row(
      children: [
        CircleAvatar(
          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
          foregroundColor: Theme.of(context).colorScheme.primary,
          child: Icon(icon),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(description, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}
