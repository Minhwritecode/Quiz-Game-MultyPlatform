import 'package:flutter/material.dart';

import 'package:papyrus/core/widgets/papyrus_ui.dart';

class RoomLobbyPage extends StatefulWidget {
  const RoomLobbyPage({super.key});

  @override
  State<RoomLobbyPage> createState() => _RoomLobbyPageState();
}

class _RoomLobbyPageState extends State<RoomLobbyPage> {
  final _codeController = TextEditingController();
  final bool _creating = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Battle room')),
      body: PapyrusPage(
        child: ListView(
          children: [
            const PapyrusHeader(
              eyebrow: 'Play together',
              title: 'Make revision feel alive',
              subtitle: 'A fair, server-timed room for two to four learners.',
            ),
            const SizedBox(height: 24),
            LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 760;
                final create = PapyrusCard(
                  color: Theme.of(context).colorScheme.primary,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.add_circle_outline_rounded,
                        size: 32,
                        color: Theme.of(context).colorScheme.onPrimary,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Host a room',
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              color: Theme.of(context).colorScheme.onPrimary,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Pick a set, share a short code and start when everyone is ready.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onPrimary
                              .withValues(alpha: 0.86),
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: FilledButton.icon(
                          onPressed: _creating
                              ? null
                              : () => _showMessage(
                                  'Room creation is ready for the realtime vertical slice.',
                                ),
                          icon: _creating
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.play_arrow_rounded),
                          label: Text(
                            _creating ? 'Creating room…' : 'Create a room',
                          ),
                        ),
                      ),
                    ],
                  ),
                );
                final join = PapyrusCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Join a room',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Enter the six-character code from your host.',
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: _codeController,
                        textCapitalization: TextCapitalization.characters,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: 'Room code',
                          hintText: 'ABC123',
                          prefixIcon: Icon(Icons.key_outlined),
                        ),
                      ),
                      const SizedBox(height: 4),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: OutlinedButton.icon(
                          onPressed: () => _showMessage(
                            _codeController.text.trim().isEmpty
                                ? 'Enter a room code first.'
                                : 'Join room is ready for the realtime vertical slice.',
                          ),
                          icon: const Icon(Icons.login_rounded),
                          label: const Text('Join room'),
                        ),
                      ),
                    ],
                  ),
                );
                return wide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: create),
                          const SizedBox(width: 20),
                          Expanded(child: join),
                        ],
                      )
                    : Column(
                        children: [create, const SizedBox(height: 16), join],
                      );
              },
            ),
            const SizedBox(height: 20),
            PapyrusCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Battle contract',
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 14),
                  const _ContractRow(
                    icon: Icons.group_outlined,
                    label: '2–4 players per room',
                  ),
                  const _ContractRow(
                    icon: Icons.timer_outlined,
                    label: 'Server time controls the window',
                  ),
                  const _ContractRow(
                    icon: Icons.gavel_outlined,
                    label: 'RPC owns scoring and duplicates',
                  ),
                  const _ContractRow(
                    icon: Icons.wifi_tethering_outlined,
                    label: 'Reconnect hold keeps the room fair',
                  ),
                ],
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

class _ContractRow extends StatelessWidget {
  const _ContractRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 12),
        Text(label),
      ],
    ),
  );
}
