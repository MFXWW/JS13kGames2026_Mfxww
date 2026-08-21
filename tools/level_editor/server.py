#!/usr/bin/env python3
"""Level Editor — HTTP API 服务器
提供静态文件服务和关卡文件保存/加载 API。
"""

import http.server
import json
import os
import urllib.parse
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001

# 自动切换到 server.py 所在目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

LEVELS_DIR = os.path.join(BASE_DIR, "level_sources")
os.makedirs(LEVELS_DIR, exist_ok=True)


class LevelEditorHandler(http.server.SimpleHTTPRequestHandler):
    """自定义 HTTP 请求处理器，支持关卡文件的 API。"""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        # API: 列出所有关卡文件
        if parsed.path == "/api/levels":
            if "name" in params:
                # GET /api/levels?name=<filename> — 读取关卡文件内容
                name = params["name"][0]
                return self._load_level(name)
            else:
                # GET /api/levels — 列出所有关卡
                return self._list_levels()

        # API: 健康检查
        if parsed.path == "/api/ping":
            self._send_json({"status": "ok"})
            return

        # 默认: 静态文件
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/api/levels" and "name" in params:
            name = params["name"][0]
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            return self._save_level(name, body)

        # 未知 API
        self._send_json({"error": "未知 API 路径"}, status=404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/api/levels" and "name" in params:
            name = params["name"][0]
            return self._delete_level(name)

        self._send_json({"error": "未知 API 路径"}, status=404)

    # ---- 内部方法 ----

    def _list_levels(self):
        """列出 level_sources 目录下所有 .txt 关卡文件"""
        try:
            files = []
            for f in sorted(os.listdir(LEVELS_DIR)):
                if f.endswith(".txt"):
                    fpath = os.path.join(LEVELS_DIR, f)
                    stat = os.stat(fpath)
                    files.append({
                        "name": f.replace(".txt", ""),
                        "filename": f,
                        "size": stat.st_size,
                        "mtime": stat.st_mtime,
                    })
            self._send_json({"levels": files})
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _load_level(self, name):
        """读取指定的关卡文件"""
        # 确保文件名安全，防止目录穿越
        safe_name = os.path.basename(name)
        if not safe_name.endswith(".txt"):
            safe_name += ".txt"
        fpath = os.path.join(LEVELS_DIR, safe_name)

        if not os.path.exists(fpath):
            self._send_json({"error": f"关卡文件 '{safe_name}' 不存在"}, status=404)
            return

        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            self._send_json({"name": name, "content": content})
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _save_level(self, name, content):
        """保存关卡文件"""
        safe_name = os.path.basename(name)
        if not safe_name.endswith(".txt"):
            safe_name += ".txt"
        fpath = os.path.join(LEVELS_DIR, safe_name)

        try:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            self._send_json({"success": True, "name": name, "filename": safe_name})
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _delete_level(self, name):
        """删除关卡文件"""
        safe_name = os.path.basename(name)
        if not safe_name.endswith(".txt"):
            safe_name += ".txt"
        fpath = os.path.join(LEVELS_DIR, safe_name)

        if not os.path.exists(fpath):
            self._send_json({"error": f"关卡文件 '{safe_name}' 不存在"}, status=404)
            return

        try:
            os.remove(fpath)
            self._send_json({"success": True, "name": name})
        except Exception as e:
            self._send_json({"error": str(e)}, status=500)

    def _send_json(self, data, status=200):
        """发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    # 为所有响应添加 CORS 头（预检请求）
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), LevelEditorHandler)
    print(f"🌐 Level Editor Server running at http://localhost:{PORT}")
    print(f"📁 Level sources: {LEVELS_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已关闭")
        server.server_close()
