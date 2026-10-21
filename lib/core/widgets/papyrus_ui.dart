import 'package:flutter/material.dart';

import 'package:papyrus/core/theme/app_tokens.dart';

class PapyrusPage extends StatelessWidget {
  const PapyrusPage({
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 24, 20, 32),
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          maxWidth: PapyrusTokens.contentMaxWidth,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class PapyrusHeader extends StatelessWidget {
  const PapyrusHeader({
    required this.eyebrow,
    required this.title,
    this.subtitle,
    this.action,
    super.key,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow.toUpperCase(),
                style: textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(title, style: textTheme.headlineMedium),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(subtitle!, style: textTheme.bodyLarge),
              ],
            ],
          ),
        ),
        if (action != null) ...[const SizedBox(width: 16), action!],
      ],
    );
  }
}

class PapyrusCard extends StatelessWidget {
  const PapyrusCard({
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color,
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Card(
      color: color,
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return card;
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(PapyrusTokens.radiusLg),
        child: card,
      ),
    );
  }
}

class PapyrusTag extends StatelessWidget {
  const PapyrusTag(
    this.label, {
    this.icon,
    this.tone = PapyrusTagTone.neutral,
    super.key,
  });

  final String label;
  final IconData? icon;
  final PapyrusTagTone tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final background = switch (tone) {
      PapyrusTagTone.primary => scheme.primaryContainer,
      PapyrusTagTone.success => PapyrusTokens.mintTint,
      PapyrusTagTone.reward => PapyrusTokens.goldTint,
      PapyrusTagTone.neutral => scheme.surfaceContainerHighest,
    };
    final foreground = switch (tone) {
      PapyrusTagTone.primary => scheme.onPrimaryContainer,
      PapyrusTagTone.success => PapyrusTokens.mint,
      PapyrusTagTone.reward => PapyrusTokens.gold,
      PapyrusTagTone.neutral => scheme.onSurfaceVariant,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 15, color: foreground),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium
                ?.copyWith(color: foreground, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

enum PapyrusTagTone { neutral, primary, success, reward }

class PapyrusStat extends StatelessWidget {
  const PapyrusStat({
    required this.value,
    required this.label,
    required this.icon,
    this.tone = PapyrusTagTone.primary,
    super.key,
  });

  final String value;
  final String label;
  final IconData icon;
  final PapyrusTagTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      PapyrusTagTone.reward => PapyrusTokens.gold,
      PapyrusTagTone.success => PapyrusTokens.mint,
      _ => Theme.of(context).colorScheme.primary,
    };
    final background = switch (tone) {
      PapyrusTagTone.reward => PapyrusTokens.goldTint,
      PapyrusTagTone.success => PapyrusTokens.mintTint,
      _ => Theme.of(context).colorScheme.primaryContainer,
    };
    return PapyrusCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: background,
            foregroundColor: color,
            child: Icon(icon, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(label, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PapyrusPrimaryButton extends StatelessWidget {
  const PapyrusPrimaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.expand = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final button = icon == null
        ? FilledButton(onPressed: onPressed, child: Text(label))
        : FilledButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
          );
    return SizedBox(
      width: expand ? double.infinity : null,
      height: 52,
      child: button,
    );
  }
}

class PapyrusSectionTitle extends StatelessWidget {
  const PapyrusSectionTitle({required this.title, this.action, super.key});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        ?action,
      ],
    );
  }
}

class PapyrusEmptyState extends StatelessWidget {
  const PapyrusEmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    super.key,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return PapyrusCard(
      child: Column(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Icon(icon, size: 28),
          ),
          const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}
