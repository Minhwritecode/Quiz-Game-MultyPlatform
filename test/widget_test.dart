import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:papyrus/app/app.dart';

void main() {
  testWidgets('Papyrus opens the home shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: PapyrusApp()));
    await tester.pumpAndSettle();

    expect(find.text('Papyrus'), findsNWidgets(2));
    expect(find.text('Turn your notes into a challenge.'), findsOneWidget);
    expect(find.text('From Ancient Scroll to AI Power.'), findsOneWidget);
  });
}
