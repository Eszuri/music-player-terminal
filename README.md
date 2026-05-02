# 🎵 Music Player Terminal

A terminal-based music player built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs) and [VLC](https://www.videolan.org/vlc/) as the audio backend. Features a beautiful TUI (Terminal User Interface) with album art, real-time metadata, and a visual progress bar.

## 📸 Preview

```
 🎵  Music Player                            ● Playing
┌────────────────────────────┐ ┌────────────────────┐
│                            │ │     PLAYLIST       │
│       [Album Art]          │ │                    │
│                            │ │  ▶ Song 01.mp3     │
│                            │ │    Song 02.flac    │
│                            │ │    Song 03.ogg     │
└────────────────────────────┘ │    ...             │
┌────────────────────────────┐ │                    │
│ Song Title                 │ └────────────────────┘
│ Artist Name  ·  Album Name │
│ ████████████░░░░░░░░░░░░░  │
│ 01:23                04:56 │
└────────────────────────────┘
📁 /Anime_Ost/SomeFolder

        ↑↓ navigate  Enter select  Esc quit
```

## ✨ Features

- 🎨 **Beautiful TUI** — Two-panel layout with album art, metadata, and scrollable playlist
- 🖼️ **Album Art Display** — Extracts and renders embedded cover art directly in the terminal
- 📊 **Real-time Progress Bar** — Visual playback progress using block characters (`█░`)
- 🔄 **Auto-play Next** — Automatically advances to the next track when a song ends
- 🗂️ **File Browser** — Navigate your music folders with keyboard controls
- 🎵 **Metadata Sync** — Syncs Title, Artist, and Album from both file tags and VLC's HTTP interface in real-time
- 📁 **Multi-format Support** — Plays `.mp3`, `.ogg`, `.wav`, and `.flac` files
- ⏭️ **Smart Skip** — Press Enter on a playing song to immediately switch to a new one

## 🛠️ Tech Stack

| Package | Purpose |
|---|---|
| [ink](https://github.com/vadimdemedes/ink) v5 | React-based terminal UI framework |
| [ink-picture](https://github.com/nicholasgasior/ink-picture) | Display images inside the terminal |
| [music-metadata](https://github.com/borewit/music-metadata) | Parse audio file metadata & cover art |
| [VLC](https://www.videolan.org/) | Audio playback backend (spawned as child process) |
| [clear](https://www.npmjs.com/package/clear) | Clear terminal screen |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe development |
| [tsup](https://tsup.egoist.dev/) | Bundle for production |
| [tsx](https://tsx.is/) | Run TypeScript directly for development |

## 📋 Prerequisites

1. **Node.js** v18+ installed
2. **VLC media player** installed and accessible from the terminal:
   ```bash
   # Ubuntu/Debian
   sudo apt install vlc

   # Arch Linux
   sudo pacman -S vlc

   # macOS (Homebrew)
   brew install --cask vlc
   ```
3. A music folder. By default, the app looks for an `Anime_Ost` folder **three levels above the project directory**:
   ```
   /your/path/Anime_Ost/     ← Music folder (hardcoded)
   /your/path/Codingan/node js/music-player-terminal/  ← Project
   ```
   > ⚠️ See [Configuration](#-configuration) to change the music folder path.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Eszuri/music-player-terminal.git
cd music-player-terminal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run in development mode

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
npm start
```

## ⌨️ Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate the playlist |
| `Enter` | Open a folder / Play a song |
| `Esc` | Stop playback and quit |

## ⚙️ Configuration

### Changing the Music Folder

Open `src/index.tsx` and modify line 21:

```typescript
// Default (3 levels up from project root)
const rootFolder = path.join(process.cwd(), "./../../../Anime_Ost");

// Example: Use an absolute path
const rootFolder = "/home/youruser/Music";

// Example: Use a path relative to the project
const rootFolder = path.join(process.cwd(), "./music");
```

### Changing the VLC HTTP Password

VLC is launched with an HTTP interface on `localhost:8080` for real-time status polling. The default password is `Eszuri`. To change it, update `src/index.tsx`:

```typescript
// Line ~158: Change the password in the VLC spawn arguments
'--http-password=YourNewPassword',

// Line ~119: Also update the Authorization header in the fetch call
Authorization: 'Basic ' + Buffer.from(':YourNewPassword').toString('base64')
```

## 📁 Project Structure

```
music-player-terminal/
├── src/
│   ├── index.tsx       # Main application (UI, logic, VLC integration)
│   ├── cp.tsx          # Asset copy utilities (default image)
│   └── default.png     # Default cover art shown when no art is embedded
├── build/              # Compiled output (generated)
│   ├── index.js
│   ├── background.png  # Current cover art (updated on each song)
│   └── default.png
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## 🔧 How It Works

1. **Startup**: `CopyAssests()` copies `default.png` into the `build/` directory, then the React app renders inside the terminal using Ink.
2. **Navigation**: `useInput` captures keyboard events. Arrow keys navigate the `folder[]` state array; Enter opens a folder or plays a file.
3. **Playback**: When a file is selected, VLC is spawned as a child process with its HTTP interface enabled. The app polls `http://localhost:8080/requests/status.json` every 500ms to get real-time playback status (position, duration, metadata).
4. **Metadata**: `music-metadata` parses the audio file to extract the cover art and tags. The cover art is written to `build/background.png` synchronously before the UI updates, ensuring the `Image` component always shows the correct art.
5. **Auto-advance**: When VLC's process closes, the app checks if there are more tracks. If yes, `selectedIndex` is incremented and `trigger` is toggled, restarting the `useEffect` for the next song.

## 📝 License

ISC
