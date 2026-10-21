import 'package:flutter/material.dart';

import 'package:papyrus/core/constants/app_constants.dart';
import 'package:papyrus/core/theme/app_tokens.dart';
import 'package:papyrus/core/widgets/papyrus_ui.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _haptics = true;
  bool _reduceMotion = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: PapyrusPage(
        child: ListView(
          children: [
            PapyrusCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: Theme.of(context)
                        .colorScheme
                        .primaryContainer,
                    foregroundColor: Theme.of(context).colorScheme.primary,
                    child: const Icon(Icons.person_outline_rounded, size: 28),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Guest learner',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 5),
                        Text('Offline mode · sign in to sync across devices'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const PapyrusSectionTitle(title: 'Preferences'),
            const SizedBox(height: 10),
            PapyrusCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  const ListTile(
                    leading: Icon(Icons.dark_mode_outlined),
                    title: Text('Appearance'),
                    subtitle: Text('Follow system light/dark mode'),
                    trailing: Text('System'),
                  ),
                  const Divider(height: 1),
                  const ListTile(
                    leading: Icon(Icons.language_outlined),
                    title: Text('Language'),
                    subtitle: Text('Question generation language'),
                    trailing: Text('English'),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    value: _haptics,
                    onChanged: (value) => setState(() => _haptics = value),
                    secondary: const Icon(Icons.vibration_outlined),
                    title: const Text('Haptic feedback'),
                    subtitle: const Text('Confirm important actions'),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    value: _reduceMotion,
                    onChanged: (value) => setState(() => _reduceMotion = value),
                    secondary: const Icon(Icons.motion_photos_off_outlined),
                    title: const Text('Reduce motion'),
                    subtitle: const Text('Prefer calmer transitions'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const PapyrusSectionTitle(title: 'Data & sync'),
            const SizedBox(height: 10),
            PapyrusCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  const ListTile(
                    leading: Icon(
                      Icons.sync_outlined,
                      color: PapyrusTokens.mint,
                    ),
                    title: Text('Sync status'),
                    subtitle: Text('All local changes are safe'),
                    trailing: PapyrusTag('Ready', tone: PapyrusTagTone.success),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.storage_outlined),
                    title: const Text('Manage local data'),
                    subtitle: const Text('Review cached question sets'),
                    trailing: IconButton(
                      onPressed: () => _showMessage(
                        'Local data manager is ready for the persistence vertical slice.',
                      ),
                      icon: const Icon(Icons.chevron_right_rounded),
                      tooltip: 'Open local data',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            PapyrusCard(
              color: PapyrusTokens.indigoTint,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppConstants.appName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text('${AppConstants.slogan}\nBase v0.1.0'),
                  const SizedBox(height: 12),
                  Text(
                    'Built for focused study, thoughtful competition and quiet offline moments.',
                    style: Theme.of(context).textTheme.bodySmall,
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
