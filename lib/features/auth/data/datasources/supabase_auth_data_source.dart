import 'package:papyrus/features/auth/domain/entities/app_user.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseAuthDataSource {
  const SupabaseAuthDataSource(this.client);

  final SupabaseClient client;

  Stream<AppUser?> watchUser() async* {
    yield _map(client.auth.currentUser);
    await for (final state in client.auth.onAuthStateChange) {
      yield _map(state.session?.user);
    }
  }

  Future<void> signOut() => client.auth.signOut();

  AppUser? _map(User? user) {
    if (user == null) return null;
    return AppUser(
      id: user.id,
      email: user.email,
      displayName: user.userMetadata?['display_name'] as String? ?? 'Learner',
    );
  }
}
