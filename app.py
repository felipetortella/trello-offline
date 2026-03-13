import os
import json
import uuid
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

DATA_FILE = "data.json"
PORT = 5000

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"columns": []}
    with open(DATA_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"columns": []}

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

class TrelloHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.path = "/templates/index.html"
        
        if parsed.path == "/api/board":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(load_data()).encode())
            return
            
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        if hasattr(post_data, "decode"):
            post_data = post_data.decode('utf-8')
        
        req = json.loads(post_data) if post_data else {}
        data = load_data()

        if parsed.path == "/api/columns":
            title = req.get("title", "New Column")
            new_col = {"id": str(uuid.uuid4()), "title": title, "tasks": []}
            data["columns"].append(new_col)
            save_data(data)
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(new_col).encode())
            return
            
        elif parsed.path.startswith("/api/columns/") and parsed.path.endswith("/tasks"):
            col_id = parsed.path.split("/")[3]
            content = req.get("content", "New Task")
            new_task = {"id": str(uuid.uuid4()), "content": content}
            
            for col in data.get("columns", []):
                if col["id"] == col_id:
                    if "tasks" not in col:
                        col["tasks"] = []
                    col["tasks"].append(new_task)
                    break
            save_data(data)
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(new_task).encode())
            return
            
        elif parsed.path == "/api/columns/move":
            col_id = req.get("column_id")
            new_index = req.get("new_index")
            
            col_to_move = None
            cols = data.get("columns", [])
            for i, col in enumerate(cols):
                if col["id"] == col_id:
                    col_to_move = cols.pop(i)
                    break
            
            if not col_to_move:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Column not found"}')
                return
                
            if new_index is not None and 0 <= new_index <= len(cols):
                cols.insert(new_index, col_to_move)
            else:
                cols.append(col_to_move)
                
            data["columns"] = cols
            save_data(data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return
            
        elif parsed.path == "/api/tasks/move":
            source_col_id = req.get("source_column_id")
            target_col_id = req.get("target_column_id")
            task_id = req.get("task_id")
            new_index = req.get("new_index")
            
            task_to_move = None
            
            for col in data.get("columns", []):
                if col["id"] == source_col_id:
                    for i, task in enumerate(col.get("tasks", [])):
                        if task["id"] == task_id:
                            task_to_move = col["tasks"].pop(i)
                            break
                    break
            
            if not task_to_move:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Task not found"}')
                return
                
            for col in data.get("columns", []):
                if col["id"] == target_col_id:
                    if new_index is not None and 0 <= new_index <= len(col.get("tasks", [])):
                        col["tasks"].insert(new_index, task_to_move)
                    else:
                        col["tasks"].append(task_to_move)
                    break
            
            save_data(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        data = load_data()
        
        parts = [p for p in parsed.path.split("/") if p]
        
        if len(parts) == 3 and parts[0] == "api" and parts[1] == "columns":
            col_id = parts[2]
            cols = data.get("columns", [])
            data["columns"] = [c for c in cols if c["id"] != col_id]
            save_data(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return
            
        elif len(parts) == 5 and parts[0] == "api" and parts[1] == "columns" and parts[3] == "tasks":
            col_id = parts[2]
            task_id = parts[4]
            
            for col in data.get("columns", []):
                if col["id"] == col_id:
                    col["tasks"] = [t for t in col.get("tasks", []) if t["id"] != task_id]
                    break
            
            save_data(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return

        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        req = json.loads(post_data) if post_data else {}
        data = load_data()
        
        parts = parsed.path.split("/")
        
        if len(parts) == 6 and parts[2] == "columns" and parts[4] == "tasks":
            col_id = parts[3]
            task_id = parts[5]
            content = req.get("content", "")
            
            for col in data.get("columns", []):
                if col["id"] == col_id:
                    for task in col.get("tasks", []):
                        if task["id"] == task_id:
                            task["content"] = content
                            break
                    break
            
            save_data(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true}')
            return

        self.send_response(404)
        self.end_headers()

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, TrelloHandler)
    print(f"Starting server on port {PORT}...")
    print(f"Open http://localhost:{PORT} in your browser")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
