import 'package:papyrus/features/auth/data/datasources/supabase_auth_data_source.dart';
import 'package:papyrus/features/auth/domain/entities/app_user.dart';
import 'package:papyrus/features/auth/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this.dataSource);

  final SupabaseAuthDataSource dataSource;

  @override
  Stream<AppUser?> watchUser() => dataSource.watchUser();

  @override
  Future<void> signOut() => dataSource.signOut();
}
