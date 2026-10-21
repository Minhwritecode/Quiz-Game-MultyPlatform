import 'package:flutter/material.dart';

class LeaderboardPage extends StatelessWidget {
  const LeaderboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    const players = [
      ('You', '1,240'),
      ('Linh Nguyen', '1,180'),
      ('Minh Tran', '960'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Leaderboard')),
      body: ListView.separated(
        padding: const EdgeInsets.all(20),
        itemCount: players.length,
        separatorBuilder: (_, index) => const SizedBox(height: 8),
        itemBuilder: (context, index) => Card(
          child: ListTile(
            leading: CircleAvatar(child: Text('${index + 1}')),
            title: Text(players[index].$1),
            trailing: Text('${players[index].$2} pts'),
          ),
        ),
      ),
    );
  }
}
