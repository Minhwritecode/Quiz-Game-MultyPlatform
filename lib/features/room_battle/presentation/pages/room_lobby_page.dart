import 'package:flutter/material.dart';

class RoomLobbyPage extends StatefulWidget {
  const RoomLobbyPage({super.key});

  @override
  State<RoomLobbyPage> createState() => _RoomLobbyPageState();
}

class _RoomLobbyPageState extends State<RoomLobbyPage> {
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Room battle')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Challenge your study circle',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Realtime rooms are server-authoritative: timing, answers and scoring will be validated by Supabase RPCs.',
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => _showComingSoon(context, 'Create room'),
            icon: const Icon(Icons.add),
            label: const Text('Create a room'),
          ),
          const SizedBox(height: 24),
          Text('Join a room', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            maxLength: 6,
            decoration: const InputDecoration(
              labelText: 'Room code',
              hintText: 'ABC123',
            ),
          ),
          OutlinedButton(
            onPressed: () => _showComingSoon(context, 'Join room'),
            child: const Text('Join room'),
          ),
          const SizedBox(height: 32),
          const _BattleContractCard(),
        ],
      ),
    );
  }

  void _showComingSoon(BuildContext context, String action) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$action is ready for the realtime vertical slice.'),
      ),
    );
  }
}

class _BattleContractCard extends StatelessWidget {
  const _BattleContractCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Realtime contract',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            const Text(
              '• 2–4 players per room\n• 6-character code\n• Server time for countdown\n• submit_answer RPC owns scoring\n• 30-second reconnect hold',
            ),
          ],
        ),
      ),
    );
  }
}
