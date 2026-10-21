enum RoomStatus { waiting, countdown, questionOpen, questionResult, finished }

class Room {
  const Room({
    required this.id,
    required this.code,
    required this.hostId,
    required this.status,
    required this.playerCount,
  });

  final String id;
  final String code;
  final String hostId;
  final RoomStatus status;
  final int playerCount;
}
