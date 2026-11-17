"""
Script to test if the open Blender instance is listening on port 9876.
Run:
  python3 scripts/blender/test_blender_connection.py
"""

import socket
import json
import sys

def test_connection():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect(("127.0.0.1", 9876))
        payload = json.dumps({"type": "ping"})
        s.sendall(payload.encode('utf-8'))
        response = s.recv(4096).decode('utf-8')
        s.close()
        print("✅ Kết nối Blender MCP thành công!")
        print("Phản hồi từ Blender:", response)
        return True
    except ConnectionRefusedError:
        print("❌ Chưa kết nối được. Hãy đảm bảo bạn đã mở Blender và chạy script setup_in_blender.py.")
        return False
    except Exception as e:
        print("❌ Lỗi kết nối:", e)
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
