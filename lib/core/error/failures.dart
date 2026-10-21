sealed class Failure implements Exception {
  const Failure(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => 'Failure($code): $message';
}

final class NetworkFailure extends Failure {
  const NetworkFailure(super.message, {super.code});
}

final class ValidationFailure extends Failure {
  const ValidationFailure(super.message, {super.code});
}

final class StorageFailure extends Failure {
  const StorageFailure(super.message, {super.code});
}

final class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure(super.message, {super.code});
}
