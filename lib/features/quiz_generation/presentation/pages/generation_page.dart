import 'package:flutter/material.dart';

class GenerationPage extends StatefulWidget {
  const GenerationPage({super.key});

  @override
  State<GenerationPage> createState() => _GenerationPageState();
}

class _GenerationPageState extends State<GenerationPage> {
  double _count = 10;
  String _difficulty = 'Medium';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Generate questions')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Shape the quiz',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Questions will be streamed one by one, validated against the JSON contract, then reviewed before saving.',
          ),
          const SizedBox(height: 24),
          Text('Number of questions: ${_count.round()}'),
          Slider(
            value: _count,
            min: 5,
            max: 30,
            divisions: 25,
            label: _count.round().toString(),
            onChanged: (value) => setState(() => _count = value),
          ),
          DropdownButtonFormField<String>(
            initialValue: _difficulty,
            decoration: const InputDecoration(labelText: 'Difficulty'),
            items: ['Easy', 'Medium', 'Hard']
                .map(
                  (value) => DropdownMenuItem(value: value, child: Text(value)),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _difficulty = value ?? _difficulty),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => _showPending(context),
            icon: const Icon(Icons.auto_awesome_outlined),
            label: const Text('Start streaming generation'),
          ),
          const SizedBox(height: 20),
          const Card(
            child: ListTile(
              leading: Icon(Icons.privacy_tip_outlined),
              title: Text('Privacy checkpoint'),
              subtitle: Text(
                'Only the text you confirm will be sent to the authenticated Edge Function.',
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showPending(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Generation provider adapter is ready for the next vertical slice.',
        ),
      ),
    );
  }
}
