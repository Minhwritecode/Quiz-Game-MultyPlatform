import type { RoomData } from '../domain/models';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const simulatedRooms: Record<string, RoomData> = {};

export const roomApi = {
  async create(quizId: string): Promise<{ roomCode: string; room: RoomData }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId, hostId: 'papyrus-host' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.roomCode) {
          return { roomCode: json.data.roomCode, room: json.data };
        }
      }
    } catch {
      // Offline fallback
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fallbackRoom: RoomData = {
      roomCode: code,
      quizId: {
        id: quizId,
        title: 'Trắc nghiệm Tri thức Tổng hợp',
        description: 'Phòng thi đấu trực tuyến thời gian thực.',
        questions: [
          {
            question: 'Sông nào dài nhất thế giới theo ghi nhận địa lý?',
            options: ['Sông Nile', 'Sông Amazon', 'Sông Dương Tử', 'Sông Mississippi'],
            correctAnswer: 1,
          },
          {
            question: 'Nguyên tố hóa học nào phong phú nhất trong vũ trụ?',
            options: ['Oxy', 'Cacbon', 'Hydro', 'Heli'],
            correctAnswer: 2,
          },
          {
            question: 'Năm nào vệ tinh đầu tiên Sputnik 1 được phóng lên quỹ đạo?',
            options: ['1945', '1957', '1969', '1975'],
            correctAnswer: 1,
          },
        ],
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      players: [
        { playerId: 'host-1', nickname: 'Chủ phòng (Bạn)', score: 0, isHost: true },
        { playerId: 'player-2', nickname: 'Minh Tuấn', score: 0 },
        { playerId: 'player-3', nickname: 'Lan Hương', score: 0 },
      ],
    };
    simulatedRooms[code] = fallbackRoom;
    return { roomCode: code, room: fallbackRoom };
  },

  async join(roomCode: string, nickname: string): Promise<{ playerId: string; room: RoomData }> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      if (res.ok) {
        const json = await res.json();
        return { playerId: json.data?.playerId || `player-${Date.now()}`, room: json.data?.room || json.data };
      }
    } catch {
      // Offline fallback
    }

    const room = simulatedRooms[roomCode] || {
      roomCode,
      quizId: {
        title: 'Phòng đấu trực tiếp',
        description: 'Vào phòng thành công',
        questions: [
          {
            question: 'Đơn vị đo cường độ dòng điện trong hệ SI là gì?',
            options: ['Volt (V)', 'Ampere (A)', 'Ohm (Ω)', 'Watt (W)'],
            correctAnswer: 1,
          },
          {
            question: 'Hành tinh nào được mệnh danh là Hành tinh Đỏ?',
            options: ['Sao Kim', 'Sao Hỏa', 'Sao Mộc', 'Sao Thủy'],
            correctAnswer: 1,
          },
        ],
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      players: [
        { playerId: 'host-1', nickname: 'Host Master', score: 0, isHost: true },
        { playerId: `player-${Date.now()}`, nickname, score: 0 },
      ],
    };
    simulatedRooms[roomCode] = room;
    return { playerId: `player-${Date.now()}`, room };
  },

  async get(roomCode: string): Promise<RoomData> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms/${roomCode}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) return json.data;
      }
    } catch {
      // Offline
    }

    return (
      simulatedRooms[roomCode] || {
        roomCode,
        quizId: {
          title: 'Phòng Quiz Trực tiếp',
          description: 'Trận đấu multiplayer',
          questions: [],
        },
        status: 'waiting',
        currentQuestionIndex: 0,
        players: [],
      }
    );
  },
};
