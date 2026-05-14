import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Text, render, Box, useApp, useInput } from 'ink';
import Image, { TerminalInfoProvider } from "ink-picture";
import fs from 'fs';
import path from 'path';
import clear from 'clear';
import { IAudioMetadata, parseFile } from 'music-metadata';
import { CopyAssests, CopyDefaultImage } from './cp.js';
import { autoWallpaper } from './auto-wallpaper.js';

const PROJECT_ROOT = path.resolve(import.meta.dir, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
const DEFAULT_IMG = path.join(BUILD_DIR, 'default.png');
const WALLPAPER_IMG = path.join(BUILD_DIR, 'wallpaper.png');
const BAR_LENGTH = 45;

const AlbumArt = React.memo(({ metadata, imagePath }: { metadata: IAudioMetadata | undefined, imagePath: string }) => {
    return (
        <Image
            src={imagePath}
            width={100}
            height={100}
        />
    );
});


export default function App() {
    // variabel
    const [folder, setFolder] = useState<string[]>([]);
    const [metadata, SetMetadata] = useState<IAudioMetadata>()
    const [progress, setProgress] = useState<string>('');
    const [totalProgress, setTotalProgress] = useState<string>('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentPath, setCurrentPath] = useState('');
    const [status, setStatus] = useState<number>(0);
    const [trigger, SetTrigger] = useState<boolean>(false);
    const [imagePath, setImagePath] = useState<string>(DEFAULT_IMG);
    const rootFolder = path.resolve(PROJECT_ROOT, "../../..", "Anime_Ost");
    const vlcRef = useRef<any>(null);
    const enterTrigger = useRef(false);
    const fullPath = path.join(rootFolder, currentPath);
    const { exit } = useApp();






    // handle keyboard
    useInput(async (input, key) => {
        if (key.escape) {
            if (vlcRef.current == null || vlcRef.current != null) { vlcRef.current?.kill() };
            await CopyDefaultImage();
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
        }

        if (key.upArrow) {
            setSelectedIndex(prev => (prev - 1 + folder.length) % folder.length);
        }

        if (input === 'Enter' || key.return) {
            const targetPath = path.join(fullPath, selectedItem);
            const checkType = fs.statSync(targetPath);

            if (selectedIndex === 0) {
                const parent = path.dirname(currentPath);
                setCurrentPath(path.relative(rootFolder, path.join(rootFolder, parent)));
                return;
            }

            if (checkType.isDirectory()) {
                clear({ fullClear: true });
                setCurrentPath(path.relative(rootFolder, targetPath));
                setSelectedIndex(0);
                console.clear();
            }

            if (checkType.isFile()) {
                if (status == 1 && vlcRef.current) {
                    enterTrigger.current ? enterTrigger.current = true : enterTrigger.current = true;
                    vlcRef.current.kill();
                    SetTrigger(!trigger);
                } else {
                    setStatus(1)
                    vlcRef.current ? vlcRef.current.kill() : null;
                    SetTrigger(!trigger);

                }
            }
        }

    });


    // function untuk save image dan set wallpaper
    async function getMetadata(filePath: string) {
        if (!filePath) return;

        try {
            if (!fs.existsSync(filePath)) return;

            const xyz = await parseFile(filePath);
            SetMetadata(xyz); // Update text metadata immediately

            const picture = xyz.common.picture?.[0];

            if (picture) {
                const newImgPath = path.join(BUILD_DIR, `bg_${Date.now()}.png`);
                fs.writeFileSync(newImgPath, picture.data);

                const oldPath = imagePath;
                setImagePath(newImgPath);

                // Copy untuk wallpaper agar tidak bentrok (file lock) dengan UI terminal
                try { fs.copyFileSync(newImgPath, WALLPAPER_IMG); } catch (e) { }

                setTimeout(() => {
                    autoWallpaper(WALLPAPER_IMG);
                }, 100);

                // Hapus file lama setelah jeda
                setTimeout(() => {
                    if (oldPath && oldPath !== DEFAULT_IMG && fs.existsSync(oldPath)) {
                        try { fs.unlinkSync(oldPath); } catch (e) { }
                    }
                }, 1000);
            } else {
                const oldPath = imagePath;
                setImagePath(DEFAULT_IMG);

                try { fs.copyFileSync(DEFAULT_IMG, WALLPAPER_IMG); } catch (e) { }

                setTimeout(() => {
                    if (oldPath && oldPath !== DEFAULT_IMG && fs.existsSync(oldPath)) {
                        try { fs.unlinkSync(oldPath); } catch (e) { }
                    }
                }, 1000);

                setTimeout(() => {
                    autoWallpaper(WALLPAPER_IMG);
                }, 100);
            }
            return xyz;
        } catch (err) {
            fs.appendFileSync(path.join(PROJECT_ROOT, 'debug.log'), `[${new Date().toISOString()}] Error in getMetadata: ${err}\n`);
            return err;
        }
    }



    // format time 
    function formatTime(seconds: any) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }


    // eksekusi ketika return lagu
    useEffect(() => {
        const runPlayback = async () => {
            const selectedFile = folder[selectedIndex];
            if (!selectedFile || selectedFile === '../') return;

            const absoluteSongPath = path.resolve(fullPath, selectedFile);

            // Tunggu metadata dan gambar selesai diproses sebelum memutar lagu
            await getMetadata(absoluteSongPath);

            const vlcHttpPort = 9090;
            const vlcHttpPassword = 'musicplayer';

            const proc = Bun.spawn([
                'vlc',
                '--intf', 'dummy',
                '--extraintf', 'http',
                '--http-port', String(vlcHttpPort),
                '--http-password', vlcHttpPassword,
                '--no-video',
                '--play-and-exit',
                absoluteSongPath
            ], {
                stdin: "pipe",
                stdout: "pipe",
                onExit: async () => {
                    clearInterval(progressInterval)
                    if (folder.length == selectedIndex + 1) {
                        vlcRef.current = null;
                        setSelectedIndex(0);
                        setStatus(2);
                        await CopyDefaultImage();
                        autoWallpaper();
                    } else {
                        if (enterTrigger.current == false) {
                            setSelectedIndex(prev => prev + 1);
                        } else {
                            enterTrigger.current = false;
                        }
                        SetTrigger(!trigger)
                    }
                }
            });

            vlcRef.current = proc;

            const progressInterval = setInterval(async () => {
                try {
                    const res = await fetch(`http://127.0.0.1:${vlcHttpPort}/requests/status.xml`, {
                        headers: {
                            'Authorization': 'Basic ' + btoa(`:${vlcHttpPassword}`)
                        }
                    });
                    if (res.ok) {
                        const text = await res.text();
                        const timeMatch = text.match(/<time>(\d+)<\/time>/);
                        const lengthMatch = text.match(/<length>(\d+)<\/length>/);
                        if (timeMatch && lengthMatch) {
                            const current = parseInt(timeMatch[1], 10);
                            const total = parseInt(lengthMatch[1], 10);
                            setTotalProgress(formatTime(total));
                            const percent: any = total > 0 ? (current / total * 100).toFixed(2) : 0;
                            setProgress(formatTime(current) + " / " + "(" + percent + ")" + "%");
                        }
                    }
                } catch (err) {
                    // Ignore fetch errors
                }
            }, 200);

            vlcRef.current.progressInterval = progressInterval;
        };

        runPlayback();

        return () => {
            if (vlcRef.current) {
                if (vlcRef.current.progressInterval) clearInterval(vlcRef.current.progressInterval);
                try { vlcRef.current.kill(); } catch (e) { }
            }
        };
    }, [trigger]);


    // mengambil data file lagu
    useEffect(() => {
        fs.readdir(path.join(rootFolder, currentPath), (err, data) => {
            if (err) {
                console.error('Failed to read directory:', err);
                return;
            }
            const sorted = data
                .map(f => ({ file: f, mtime: fs.statSync(path.join(fullPath, f)).mtime }))
                .sort((a: any, b: any) => a.mtime - b.mtime)
                .map(f => f.file);
            if (fullPath == rootFolder) {
                setFolder(['../', ...sorted]);
            } else {
                const filterFileType = ['.mp3', '.ogg', '.wav', '.flac']
                const x = sorted.filter(item => filterFileType.some(format => item.toLowerCase().endsWith(format)))
                if (fs.statSync(path.join(fullPath)).isDirectory()) {
                    setFolder(['../', ...sorted])
                } else {
                    setFolder(['../', ...x])
                }
            }
        });
    }, [currentPath]);


    // UI Logic
    const { visibleItems, scrollStart } = useMemo(() => {
        const visibleCount = 35;
        const start = Math.min(
            Math.max(selectedIndex - Math.floor(visibleCount / 2), 0),
            Math.max(folder.length - visibleCount, 0)
        );
        const sliced = folder.slice(start, start + visibleCount);

        // Log exactly what's being sent to the UI
        fs.appendFileSync(path.join(PROJECT_ROOT, 'debug.log'), `[${new Date().toISOString()}] Rendering ${sliced.length} items. ScrollStart: ${start}, Selected: ${selectedIndex}\n`);

        return {
            visibleItems: sliced,
            scrollStart: start
        };
    }, [selectedIndex, folder]);

    const progressBar = useMemo(() => {
        const percentMatch = progress.match(/\((.*?)\)%/);
        const percentValue = percentMatch ? parseFloat(percentMatch[1]) : 0;
        const filledLength = Math.floor((percentValue / 100) * BAR_LENGTH);
        return '█'.repeat(filledLength) + '░'.repeat(Math.max(0, BAR_LENGTH - filledLength));
    }, [progress]);

    return (
        <TerminalInfoProvider>
            <Box flexDirection="column" width="100%" padding={1}>

                <Box justifyContent="space-between" marginBottom={1}>
                    <Text bold color="white"> 🎵  Music Player</Text>
                    <Text color="cyan">
                        {status === 0 && '● Stopped'}
                        {status === 1 && '● Playing'}
                        {status === 2 && '● Ended'}
                    </Text>
                </Box>

                <Box flexDirection="row" flexGrow={1} minHeight={28}>

                    {/* Left Panel: Art + Info stacked */}
                    <Box flexDirection="column" width="50%" marginRight={2}>

                        {/* Large Album Art */}
                        <Box
                            width="100%"
                            height={34}
                            borderStyle="single"
                            borderColor="gray"
                        >
                            <AlbumArt
                                metadata={metadata}
                                imagePath={imagePath}
                            />
                        </Box>

                        {/* Metadata Info */}
                        <Box
                            flexDirection="column"
                            width={"100%"}
                            borderStyle="single"
                            borderColor="gray"
                            paddingX={2}
                            paddingY={0}
                        >
                            <Box flexDirection="row" marginBottom={0}>
                                <Text color="white" bold wrap="truncate-end">
                                    {metadata?.common.title || folder[selectedIndex] || '—'}
                                </Text>
                            </Box>
                            <Box flexDirection="row">
                                <Text color="white">{metadata?.common.artist || 'Unknown Artist'}</Text>
                                {metadata?.common.album ? <Text color="cyan" wrap='truncate-end'>  ·  {metadata.common.album}</Text> : null}
                            </Box>

                            {/* Progress Bar */}
                            <Box flexDirection="column" marginTop={1}>
                                <Text color="greenBright">{progressBar}</Text>
                                <Box flexDirection="row" justifyContent="space-between" width={BAR_LENGTH}>
                                    <Text color="white">{progress.split(' / ')[0] || '00:00:00'}</Text>
                                    <Text color="white">{totalProgress || '00:00:00'}</Text>
                                </Box>
                            </Box>
                        </Box>

                        {/* Directory */}
                        <Box marginTop={1} paddingX={1}>
                            <Text color="cyan" wrap="truncate-start">📁 {currentPath || '/'}</Text>
                        </Box>
                    </Box>

                    {/* Right Panel: Playlist */}
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
                        <Text color="white" bold> ↑↓ </Text>navigate  <Text color="white" bold> Enter </Text>select  <Text color="white" bold> Esc </Text>quit
                    </Text>
                </Box>
            </Box>
        </TerminalInfoProvider>
    );
}

async function Renderer() {
    await CopyAssests();
    clear();
    render(<App />);
}

Renderer();
