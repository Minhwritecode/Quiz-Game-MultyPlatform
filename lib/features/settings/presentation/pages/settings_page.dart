import 'package:flutter/material.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Card(
            child: ListTile(
              leading: CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text('Guest learner'),
              subtitle: Text('Offline mode · sign in to sync across devices'),
            ),
          ),
          const SizedBox(height: 20),
          Text('Preferences', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Card(
            child: Column(
              children: [
                ListTile(
                  leading: Icon(Icons.dark_mode_outlined),
                  title: Text('Appearance'),
                  trailing: Text('System'),
                ),
                ListTile(
                  leading: Icon(Icons.language_outlined),
                  title: Text('Language'),
                  trailing: Text('English'),
                ),
                ListTile(
                  leading: Icon(Icons.sync_outlined),
                  title: Text('Sync status'),
                  trailing: Text('Ready'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('About', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const ListTile(
            title: Text('Papyrus'),
            subtitle: Text('From Ancient Scroll to AI Power.\nBase v0.1.0'),
          ),
        ],
      ),
    );
  }
}
