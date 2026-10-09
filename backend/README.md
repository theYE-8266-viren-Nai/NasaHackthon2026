# Flame analysis backend

## Run

```powershell
$py = "C:\Users\yethi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py backend/server.py
```

Endpoints:

- `GET /api/health`
- `GET /api/experiments`
- `POST /api/analyze-frames`
- `POST /api/rank`

The frontend should decode the MP4 in the browser, sample frames to JPEG, and
send them to `/api/analyze-frames` as JSON. This avoids requiring OpenCV or an
FFmpeg installation on the demo machine.

Example request shape:

```json
{
  "experiment_id": "B1_147",
  "frames": [
    {"timestamp_s": 0, "image": "data:image/jpeg;base64,..."}
  ]
}
```

`/api/rank` accepts a list of completed analysis results and returns an
explainable research-review ranking. It is intentionally not presented as a
certified spacecraft hazard score.
