# Transcription (optional)

Images work without any transcription. Transcription only adds **what was said** to the index.
Three sources, first one that works wins:

1. **Embedded subtitle track** — free, most accurate.
2. **`--transcript-file PATH`** — an SRT, or JSON `[{start,end,text}]`. Skips ASR entirely.
3. **ASR endpoint** — an OpenAI-compatible `POST {baseUrl}/audio/transcriptions`.

If none is available, the index records `transcript=no-key` / `no-audio` and you must not
claim the video has no speech.

## Configure an endpoint

Config file: `~/.video-storyboard/asr.json` (or `$VIDEO_STORYBOARD_HOME/asr.json`; an existing
`~/.dsh/asr.json` is still read).

```json
{
  "baseUrl": "http://127.0.0.1:8000/v1",
  "model": "paraformer-zh-2024-03-09",
  "language": "zh",
  "hotwords": "位错 滑移 柏氏矢量",
  "terms": { "像差": "像差", "相差": "像差" },
  "manage": {
    "start": ["D:/asr-local/.venv/Scripts/python.exe", "D:/asr-local/server-sherpa.py"],
    "idleMs": 5000,
    "waitMs": 60000
  }
}
```

- Loopback `baseUrl` (`127.0.0.1`, `localhost`, `[::1]`, `0.0.0.0`) **requires no key**.
- A remote endpoint needs a key: `"key": "sk-..."` in the file, or `VIDEO_STORYBOARD_ASR_KEY`
  (legacy `DSH_ASR_KEY`).
- `manage.start` lets the tool launch the local service on demand and stop it after `idleMs`
  of inactivity (it calls the service's `POST /shutdown`). Recommended `idleMs`: 5 s for
  sherpa, 600000 ms for funasr.
- `terms` is a post-processing correction map (applied after transcription, so it does not
  change the cache key). `hotwords` bias decoding on backends that support it.
- The config is hot-reloaded by mtime; no restart needed.

Environment overrides (new names first, legacy in parentheses):

```
VIDEO_STORYBOARD_ASR_BASE_URL   (DSH_ASR_BASE_URL)
VIDEO_STORYBOARD_ASR_KEY        (DSH_ASR_KEY)
VIDEO_STORYBOARD_ASR_MODEL      (DSH_ASR_MODEL)
VIDEO_STORYBOARD_ASR_LANG       (DSH_ASR_LANG)
VIDEO_STORYBOARD_ASR_TERMS      (DSH_ASR_TERMS)
VIDEO_STORYBOARD_ASR_DEBUG      (DSH_ASR_DEBUG)
```

## Verify cheaply

```bash
node bin/asr-check.mjs "<input>" --from 60 --seconds 12
```

Runs the same availability check as the storyboard, on 12 seconds of audio. Use it before
transcribing an hour of footage.

## Supply your own transcript

```bash
node bin/storyboard.mjs "<input>" --transcript-file subs.srt --text
node bin/locate.mjs "<input>" "关键词" --transcript-file subs.srt --json
```

Accepted: SRT, and JSON arrays of `{ start, end, text }` (seconds). Existing subtitles from
Bilibili/YouTube are preferred over ASR when the file is a URL resolved by yt-dlp.

## Hard subtitles instead of speech

For music videos, PVs and bilingual art titles there is no usable speech but the text is
burned into the picture:

```bash
node bin/subtitles.mjs "<input>" --max-strips 24 --step 3 --out strip.jpg --json
```

This produces one tall image. Read it top-to-bottom; strip *i* corresponds to the *i*-th time
in `timeline`. Blank strips mean “no subtitle at that moment”, which is also information.

## OCR correction

`--detail high` turns on local OCR correction of ASR text against on-screen subtitles, when a
Python interpreter with `rapidocr` is available. Point the tool at it in `video.json`:

```json
{ "ocr": { "python": "D:/ocr-local/.venv/Scripts/python.exe" } }
```

No OCR engine is bundled; without one, correction is skipped silently and the ASR text is
used as-is.
