import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Text, render, Box, useApp, useInput } from 'ink';
import Image, { TerminalInfoProvider } from 'ink-picture';
import fs from 'fs';
import path from 'path';
import { IAudioMetadata, parseFile } from 'music-metadata';
import { CopyAssets, CopyDefaultImage } from './cp.js';
import { autoWallpaper } from './auto-wallpaper.js';

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(import.meta.dir, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });

const DEFAULT_IMG = path.join(BUILD_DIR, 'default.png');
const WALLPAPER_IMG = path.join(BUILD_DIR, 'wallpaper.png');
const ROOT_FOLDER = path.resolve(PROJECT_ROOT, '../../..', 'Anime_Ost');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.flac']);
const BAR_LENGTH = 45;
const VISIBLE_COUNT = 35;
const VLC_HTTP_PORT = 9090;
const VLC_HTTP_PASSWORD = 'VLC';
const VLC_AUTH_HEADER = 'Basic ' + btoa(`:${VLC_HTTP_PASSWORD}`);
const PROGRESS_INTERVAL_MS = 200;
const WALLPAPER_DELAY_MS = 100;
const CLEANUP_DELAY_MS = 1000;

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Format detik menjadi string HH:MM:SS */
function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

/** Hapus file gambar lama setelah jeda agar tidak bentrok dengan UI */
function scheduleImageCleanup(oldPath: string): void {
    if (!oldPath || oldPath === DEFAULT_IMG) return;
    setTimeout(() => {
        if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch { /* abaikan error */ }
        }
    }, CLEANUP_DELAY_MS);
}

// ─── Komponen AlbumArt ────────────────────────────────────────────────────────

const AlbumArt = React.memo(({ imagePath }: { imagePath: string }) => (
    <Image src={imagePath} width={100} height={100} />
));

// ─── Komponen Utama ───────────────────────────────────────────────────────────

export default function App() {
    const [folder, setFolder] = useState<string[]>([]);
    const [metadata, setMetadata] = useState<IAudioMetadata>();
    const [progress, setProgress] = useState('');
    const [totalProgress, setTotalProgress] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentPath, setCurrentPath] = useState('');
    const [status, setStatus] = useState(0);
    const [trigger, setTrigger] = useState(false);
    const [imagePath, setImagePath] = useState(DEFAULT_IMG);

    const vlcRef = useRef<any>(null);
    const enterTrigger = useRef(false);
    const fullPath = path.join(ROOT_FOLDER, currentPath);
    const { exit } = useApp();

    // ─── Handler Keyboard ─────────────────────────────────────────────────────

    useInput(async (input, key) => {
        if (key.escape) {
            vlcRef.current?.kill();
            CopyDefaultImage();
            autoWallpaper();
            exit();
            console.clear();
            return;
        }

        if (folder.length === 0) return;

        const selectedItem = folder[selectedIndex];
        if (selectedItem === undefined) return;

        if (key.downArrow) {
            setSelectedIndex(prev => (prev + 1) % folder.length);
            return;
        }

        if (key.upArrow) {
            setSelectedIndex(prev => (prev - 1 + folder.length) % folder.length);
            return;
        }

        if (input === 'Enter' || key.return) {
            const targetPath = path.join(fullPath, selectedItem);
            const stat = fs.statSync(targetPath);

            if (selectedIndex === 0) {
                const parent = path.dirname(currentPath);
                setCurrentPath(path.relative(ROOT_FOLDER, path.join(ROOT_FOLDER, parent)));
                return;
            }

            if (stat.isDirectory()) {
                setCurrentPath(path.relative(ROOT_FOLDER, targetPath));
                setSelectedIndex(0);
                return;
            }

            if (stat.isFile()) {
                // Jika sedang memutar, tandai bahwa pengguna memilih lagu baru secara manual
                if (status === 1 && vlcRef.current) {
                    enterTrigger.current = true;
                    vlcRef.current.kill();
                } else {
                    setStatus(1);
                    vlcRef.current?.kill();
                }
                setTrigger(prev => !prev);
            }
        }
    });

    // ─── Ekstrak Metadata & Update Wallpaper ──────────────────────────────────

    const getMetadata = useCallback(async (filePath: string): Promise<IAudioMetadata | undefined> => {
        if (!filePath || !fs.existsSync(filePath)) return;

        try {
            const parsed = await parseFile(filePath);
            setMetadata(parsed);

            const picture = parsed.common.picture?.[0];
            const oldPath = imagePath;

            if (picture) {
                const newImgPath = path.join(BUILD_DIR, `bg_${Date.now()}.png`);
                fs.writeFileSync(newImgPath, picture.data);
                setImagePath(newImgPath);
                try { fs.copyFileSync(newImgPath, WALLPAPER_IMG); } catch { /* abaikan */ }
            } else {
                setImagePath(DEFAULT_IMG);
                try { fs.copyFileSync(DEFAULT_IMG, WALLPAPER_IMG); } catch { /* abaikan */ }
            }

            // Set wallpaper setelah jeda singkat agar file tersedia
            setTimeout(() => autoWallpaper(WALLPAPER_IMG), WALLPAPER_DELAY_MS);
            scheduleImageCleanup(oldPath);

            return parsed;
        } catch (err) {
            fs.appendFileSync(
                path.join(PROJECT_ROOT, 'debug.log'),
                `[${new Date().toISOString()}] Error in getMetadata: ${err}\n`
            );
        }
    }, [imagePath]);

    // ─── Pemutaran Lagu ───────────────────────────────────────────────────────

    useEffect(() => {
        const runPlayback = async () => {
            const selectedFile = folder[selectedIndex];
            if (!selectedFile || selectedFile === '../') return;

            const absoluteSongPath = path.resolve(fullPath, selectedFile);

            // Tunggu metadata selesai sebelum memulai pemutaran
            await getMetadata(absoluteSongPath);

            const proc = Bun.spawn([
                'vlc',
                '--intf', 'dummy',
                '--extraintf', 'http',
                '--http-port', String(VLC_HTTP_PORT),
                '--http-password', VLC_HTTP_PASSWORD,
                '--no-video',
                '--play-and-exit',
                absoluteSongPath,
            ], {
                stdin: 'pipe',
                stdout: 'pipe',
                onExit: async () => {
                    clearInterval(progressInterval);
                    const isLastTrack = folder.length === selectedIndex + 1;
                    if (isLastTrack) {
                        vlcRef.current = null;
                        setSelectedIndex(0);
                        setStatus(2);
                        CopyDefaultImage();
                        autoWallpaper();
                    } else if (!enterTrigger.current) {
                        // Lanjut ke lagu berikutnya secara otomatis
                        setSelectedIndex(prev => prev + 1);
                        setTrigger(prev => !prev);
                    } else {
                        // Pengguna memilih lagu secara manual, trigger sudah di-set
                        enterTrigger.current = false;
                    }
                },
            });

            vlcRef.current = proc;

            // Polling progress dari VLC HTTP API
            const progressInterval = setInterval(async () => {
                try {
                    const res = await fetch(
                        `http://127.0.0.1:${VLC_HTTP_PORT}/requests/status.xml`,
                        { headers: { Authorization: VLC_AUTH_HEADER } }
                    );
                    if (!res.ok) return;

                    const text = await res.text();
                    const timeMatch = text.match(/<time>(\d+)<\/time>/);
                    const lengthMatch = text.match(/<length>(\d+)<\/length>/);

                    if (timeMatch && lengthMatch) {
                        const current = parseInt(timeMatch[1], 10);
                        const total = parseInt(lengthMatch[1], 10);
                        const percent = total > 0 ? ((current / total) * 100).toFixed(2) : '0.00';
                        setProgress(`${formatTime(current)} / (${percent})%`);
                        setTotalProgress(formatTime(total));
                    }
                } catch {
                    // Abaikan error jaringan selama polling
                }
            }, PROGRESS_INTERVAL_MS);

            vlcRef.current.progressInterval = progressInterval;
        };

        runPlayback();

        return () => {
            if (vlcRef.current) {
                clearInterval(vlcRef.current.progressInterval);
                try { vlcRef.current.kill(); } catch { /* abaikan */ }
            }
        };
    }, [trigger]);

    // ─── Baca Isi Direktori ───────────────────────────────────────────────────

    useEffect(() => {
        console.clear();
        fs.readdir(path.join(ROOT_FOLDER, currentPath), (err, entries) => {
            if (err) {
                console.error('Gagal membaca direktori:', err);
                return;
            }

            // Urutkan berdasarkan waktu modifikasi
            const sorted = entries
                .map(f => ({ file: f, mtime: fs.statSync(path.join(fullPath, f)).mtime }))
                .sort((a, b) => a.mtime.getTime() - b.mtime.getTime())
                .map(f => f.file);

            if (fullPath === ROOT_FOLDER) {
                // Di root: tampilkan semua (folder & file)
                setFolder(['../', ...sorted]);
            } else {
                // Di sub-folder: pisahkan folder dan file audio
                const dirs = sorted.filter(f => fs.statSync(path.join(fullPath, f)).isDirectory());
                const audios = sorted.filter(f => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()));
                setFolder(['../', ...dirs, ...audios]);
            }
        });
    }, [currentPath]);

    // ─── Kalkulasi UI ─────────────────────────────────────────────────────────

    const { visibleItems, scrollStart } = useMemo(() => {
        const start = Math.min(
            Math.max(selectedIndex - Math.floor(VISIBLE_COUNT / 2), 0),
            Math.max(folder.length - VISIBLE_COUNT, 0)
        );
        return { visibleItems: folder.slice(start, start + VISIBLE_COUNT), scrollStart: start };
    }, [selectedIndex, folder]);

    const progressBar = useMemo(() => {
        const match = progress.match(/\((.*?)\)%/);
        const percent = match ? parseFloat(match[1]) : 0;
        const filled = Math.floor((percent / 100) * BAR_LENGTH);
        return '█'.repeat(filled) + '░'.repeat(Math.max(0, BAR_LENGTH - filled));
    }, [progress]);

    const currentTime = progress.split(' / ')[0] || '00:00:00';
    const statusLabel = ['● Stopped', '● Playing', '● Ended'][status] ?? '● Stopped';

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <TerminalInfoProvider>
            <Box flexDirection="column" width="100%" padding={1}>

                {/* Header */}
                <Box justifyContent="space-between" marginBottom={1}>
                    <Text bold color="white"> 🎵  Music Player</Text>
                    <Text color="cyan">{statusLabel}</Text>
                </Box>

                <Box flexDirection="row" flexGrow={1} minHeight={28}>

                    {/* Panel Kiri: Album Art + Info */}
                    <Box flexDirection="column" width="50%" marginRight={2}>

                        {/* Album Art */}
                        <Box width="100%" height={34} borderStyle="single" borderColor="gray">
                            <AlbumArt imagePath={imagePath} />
                        </Box>

                        {/* Info Lagu */}
                        <Box
                            flexDirection="column"
                            width="100%"
                            borderStyle="single"
                            borderColor="gray"
                            paddingX={2}
                        >
                            <Box flexDirection="row">
                                <Text color="white" bold wrap="truncate-end">
                                    {metadata?.common.title || folder[selectedIndex] || '—'}
                                </Text>
                            </Box>
                            <Box flexDirection="row">
                                <Text color="white">{metadata?.common.artist || 'Unknown Artist'}</Text>
                                {metadata?.common.album && (
                                    <Text color="cyan" wrap="truncate-end">  ·  {metadata.common.album}</Text>
                                )}
                            </Box>

                            {/* Progress Bar */}
                            <Box flexDirection="column" marginTop={1}>
                                <Text color="greenBright">{progressBar}</Text>
                                <Box flexDirection="row" justifyContent="space-between" width={BAR_LENGTH}>
                                    <Text color="white">{currentTime}</Text>
                                    <Text color="white">{totalProgress || '00:00:00'}</Text>
                                </Box>
                            </Box>
                        </Box>

                        {/* Direktori Aktif */}
                        <Box marginTop={1} paddingX={1}>
                            <Text color="cyan" wrap="truncate-start">📁 {currentPath || '/'}</Text>
                        </Box>
                    </Box>

                    {/* Panel Kanan: Playlist */}
                    <Box
                        flexDirection="column"
                        width="100%"
                        height={41}
                        borderStyle="single"
                        borderColor="gray"
                        paddingX={1}
                    >
                        <Box
                            marginBottom={1}
                            borderStyle="single"
                            borderColor="gray"
                            borderTop={false}
                            borderLeft={false}
                            borderRight={false}
                            justifyContent="center"
                        >
                            <Text bold color="white"> PLAYLIST </Text>
                        </Box>

                        {visibleItems.map((value, idx) => {
                            const actualIndex = scrollStart + idx;
                            const isSelected = actualIndex === selectedIndex;
                            return (
                                <Box key={`${actualIndex}-${value}`}>
                                    <Text
                                        color={isSelected ? 'greenBright' : 'white'}
                                        bold={isSelected}
                                        wrap="truncate-end"
                                    >
                                        {isSelected ? '▶ ' : '  '}
                                        {value}
                                    </Text>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                {/* Footer */}
                <Box marginTop={1} justifyContent="center">
                    <Text color="cyan">
                        <Text color="white" bold> ↑↓ </Text>navigasi  <Text color="white" bold> Enter </Text>pilih  <Text color="white" bold> Esc </Text>keluar
                    </Text>
                </Box>
            </Box>
        </TerminalInfoProvider>
    );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function Renderer() {
    CopyAssets();
    render(<App />);
}

Renderer();
