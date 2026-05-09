# SND voice clip audio

These three MP3s back the Sunday Night Dread demo:

- `snd-tuesday-tremblay.mp3` — Tremblay, bathroom reno, 2.5h
- `snd-thursday-cote.mp3` — Côté, electrical, 3h
- `snd-friday-bouchard.mp3` — Bouchard, plumbing, 2.5h

**Status: silent placeholders.** Each file is ~326 bytes — a valid silent MP3
header so the `<audio>` element loads without a 404, but no audible content. The
demo's transcripts (in `src/lib/sndParser.ts`) carry the user-facing meaning;
the audio is a credibility cue.

To replace with real recordings: record a 15–25s FR-CA voice note of each
transcript, export to MP3 at 64kbps mono (~150–200kb each), and overwrite. No
code changes needed; the filenames are the contract.
