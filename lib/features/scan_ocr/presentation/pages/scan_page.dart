import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ScanPage extends StatelessWidget {
  const ScanPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan material')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Capture your source',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Images are processed on-device with ML Kit. Review and correct extracted Vietnamese text before it leaves the device.',
          ),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  const Icon(Icons.document_scanner_outlined, size: 56),
                  const SizedBox(height: 12),
                  const Text('No pages selected'),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: const Text('Open camera'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Choose from gallery'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const TextField(
            maxLines: 6,
            decoration: InputDecoration(
              labelText: 'Or paste text directly',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () => context.push('/create/generate'),
            child: const Text('Continue to question generation'),
          ),
        ],
      ),
    );
  }
}
