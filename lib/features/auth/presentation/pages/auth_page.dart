import 'package:flutter/material.dart';

class AuthPage extends StatelessWidget {
  const AuthPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in to Papyrus')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'Keep your library in sync',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Guest mode remains available for offline study. Sign in when you want cloud sync and realtime rooms.',
          ),
          const SizedBox(height: 24),
          const TextField(decoration: InputDecoration(labelText: 'Email')),
          const SizedBox(height: 12),
          const TextField(
            obscureText: true,
            decoration: InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => _showScaffoldMessage(context),
            child: const Text('Sign in'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _showScaffoldMessage(context),
            icon: const Icon(Icons.g_mobiledata),
            label: const Text('Continue with Google'),
          ),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () => _showScaffoldMessage(context),
            child: const Text('Continue as guest'),
          ),
        ],
      ),
    );
  }

  void _showScaffoldMessage(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Auth adapter is ready for Supabase credentials.'),
      ),
    );
  }
}
