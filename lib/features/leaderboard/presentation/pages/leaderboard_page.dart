import 'package:flutter/material.dart';

import 'package:papyrus/core/theme/app_tokens.dart';
import 'package:papyrus/core/widgets/papyrus_ui.dart';

class LeaderboardPage extends StatelessWidget {
  const LeaderboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    const players = [
      ('You', '1,240', 'This week'),
      ('Linh Nguyen', '1,180', 'This week'),
      ('Minh Tran', '960', 'This week'),
      ('An Pham', '820', 'This week'),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Rank')),
      body: PapyrusPage(
        child: ListView(
          children: [
            const PapyrusHeader(
              eyebrow: 'Study circle',
              title: 'A little friendly pressure',
              subtitle:
                  'Points reward correct answers and calm speed—not guesswork.',
            ),
            const SizedBox(height: 24),
            PapyrusCard(
              color: PapyrusTokens.goldTint,
              child: Row(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: PapyrusTokens.gold,
                    foregroundColor: Colors.white,
                    child: Icon(Icons.emoji_events_rounded, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your current streak',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(color: PapyrusTokens.gold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '4 wins in a row',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: PapyrusTokens.gold,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const Text(
                    '+18%',
                    style: TextStyle(
                      color: PapyrusTokens.gold,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const PapyrusSectionTitle(title: 'Weekly leaderboard'),
            const SizedBox(height: 12),
            for (var index = 0; index < players.length; index++) ...[
              PapyrusCard(
                child: Row(
                  children: [
                    SizedBox(
                      width: 34,
                      child: Text(
                        '${index + 1}',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: index == 0 ? PapyrusTokens.gold : null,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    CircleAvatar(
                      backgroundColor: index == 0
                          ? PapyrusTokens.goldTint
                          : Theme.of(context).colorScheme.primaryContainer,
                      foregroundColor: index == 0
                          ? PapyrusTokens.gold
                          : Theme.of(context).colorScheme.primary,
                      child: Text(players[index].$1.substring(0, 1)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            players[index].$1,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            players[index].$3,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${players[index].$2} pts',
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
              if (index != players.length - 1) const SizedBox(height: 10),
            ],
          ],
        ),
      ),
    );
  }
}
