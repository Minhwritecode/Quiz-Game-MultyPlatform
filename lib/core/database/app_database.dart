import 'package:drift/drift.dart';

part 'app_database.g.dart';

class QuestionSets extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get subject => text()();
  DateTimeColumn get updatedAt => dateTime()();
  TextColumn get syncStatus => text().withDefault(const Constant('synced'))();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class Questions extends Table {
  TextColumn get id => text()();
  TextColumn get setId => text()();
  TextColumn get content => text()();
  TextColumn get optionsJson => text()();
  IntColumn get correctIndex => integer()();
  TextColumn get explanation => text()();
  IntColumn get position => integer()();
  DateTimeColumn get updatedAt => dateTime()();
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get entity => text()();
  TextColumn get entityId => text()();
  TextColumn get operation => text()();
  TextColumn get payload => text()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
}

@DriftDatabase(tables: [QuestionSets, Questions, SyncQueue])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  @override
  int get schemaVersion => 1;
}
