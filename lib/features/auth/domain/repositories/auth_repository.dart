import 'package:papyrus/features/auth/domain/entities/app_user.dart';

abstract interface class AuthRepository {
  Stream<AppUser?> watchUser();

  Future<void> signOut();
}
