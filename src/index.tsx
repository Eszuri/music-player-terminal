import React, { useEffect, useRef, useState } from 'react';
import { Text, render, Box, useApp, useInput } from 'ink';
import Image, { TerminalInfoProvider } from "ink-picture";
import fs from 'fs';
import path from 'path';
import clear from 'clear';
import { ChildProcess, spawn } from 'child_process';
import { IAudioMetadata, parseFile } from 'music-metadata';
import { CopyAssests, CopyDefaultImage } from './cp.js';

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
    const rootFolder = path.join(process.cwd(), "./../../../Anime_Ost");
    const vlcRef = useRef<ChildProcess | null>(null);
    const enterTrigger = useRef(false);
    const fullPath = path.join(rootFolder, currentPath);
    const { exit } = useApp();

    // handle keyboard
    useInput((input, key) => {
        if (key.escape) {
            if (vlcRef.current == null || vlcRef.current != null) { vlcRef.current?.kill() };
            CopyDefaultImage();
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
            }

            if (checkType.isFile()) {
                if (status == 1 && vlcRef.current) {
                    enterTrigger.current ? enterTrigger.current = true : enterTrigger.current = true;
                    vlcRef.current.kill();
                    SetTrigger(!trigger);
                } else {
                    getMetadata()
                    setStatus(1)
                    vlcRef.current ? vlcRef.current.kill() : null;
                    SetTrigger(!trigger);

                }
            }
        }

    });


    // function untuk save image dan set wallpaper
    async function getMetadata() {
        try {
            const xyz = await parseFile(fullPath + "/" + folder[selectedIndex]);
            const picture = xyz.common.picture?.[0];
            if (picture) {
                fs.writeFileSync('build/background.png', picture.data);
            } else {
                CopyDefaultImage();
            }
            SetMetadata(xyz);
            return xyz;
        } catch (err) { return err; }
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
        if (fullPath != rootFolder) {
            getMetadata();
            let duration = 0;  // akan diisi saat pertama kali dapat status
            const progressInterval = setInterval(async () => {
                try {
                    const response = await fetch('http://localhost:8080/requests/status.json', {
                        headers: {
                            Authorization: 'Basic ' + Buffer.from(':Eszuri').toString('base64')  // username kosong
                        }
                    });
                    const status = await response.json();

                    // Extract metadata from VLC status if available
                    const vlcMeta = status.information?.category?.meta;
                    if (vlcMeta) {
                        SetMetadata(prev => ({
                            ...prev,
                            common: {
                                ...prev?.common,
                                title: vlcMeta.title || prev?.common?.title,
                                artist: vlcMeta.artist || prev?.common?.artist,
                                album: vlcMeta.album || prev?.common?.album,
                            }
                        } as any));
                    }

                    if (status.length > 0 && duration === 0) {
                        duration = status.length;  // total duration dalam detik
                        setTotalProgress(formatTime(duration))
                    }

                    if (status.time !== undefined) {
                        const current = status.time;
                        const percent: any = duration > 0 ? (current / duration * 100).toFixed(2) : 0;
                        setProgress(formatTime(current) + " / " + "(" + percent + ")" + "%")
                    }
                } catch (err) {
                    // Silently ignore polling errors to avoid terminal flickering
                }
            }, 500);

            vlcRef.current = spawn('vlc', [
                '--qt-start-minimized',
                '--no-video',
                '--extraintf=http',       // aktifkan HTTP interface
                '--http-port=8080',       // port default 8080
                '--http-password=Eszuri', // password untuk akses
                '--play-and-exit',
                fullPath + '/' + folder[selectedIndex]]);
            if (vlcRef.current) {
                vlcRef.current.on('close', () => {
                    clearInterval(progressInterval)
                    if (folder.length == selectedIndex + 1) {
                        vlcRef.current = null;
                        setSelectedIndex(0);
                        setStatus(2);
                        CopyDefaultImage();
                    } else {
                        if (enterTrigger.current == false) {
                            setSelectedIndex(prev => prev + 1);
                        } else {
                            enterTrigger.current = false;
                        }
                        SetTrigger(!trigger)
                    }
                })
            }

            return () => {
                clearInterval(progressInterval);
            };
        }
    }, [trigger])


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

    // membuat sebuah scroll
    const visibleCount = 25;
    const scrollStart = Math.min(
        Math.max(selectedIndex - Math.floor(visibleCount / 2), 0),
        Math.max(folder.length - visibleCount, 0)
    );
    const visibleItems = folder.slice(scrollStart, scrollStart + visibleCount);



    return (
        <>
            <TerminalInfoProvider>

                <Box display='flex' width={'100%'} minHeight={15}>
                    <Box width={'100%'} borderColor={'green'} borderStyle={'single'} display='flex' flexWrap='wrap' flexDirection='column'>
                        {visibleItems.map((value, idx) => {
                            const actualIndex = scrollStart + idx;
                            const isSelected = actualIndex === selectedIndex;
                            return (<Text key={actualIndex} color={isSelected ? 'blackBright' : undefined} underline={isSelected}>{value}</Text>);
                        })}
                    </Box>
                    <Box marginLeft={80} padding={1} position='absolute' width={69} borderStyle={'single'} borderColor={"blue"} flexDirection='column'>
                        <Box flexDirection="row">
                            <Text color="cyan" bold>Name: </Text>
                            <Text bold>{metadata?.common.title || folder[selectedIndex] || 'Unknown'}</Text>
                        </Box>
                        <Box flexDirection="row">
                            <Text color="cyan" bold>Album: </Text>
                            <Text>{metadata?.common.album || 'Unknown'}</Text>
                        </Box>
                        <Box flexDirection="row">
                            <Text color="cyan" bold>Artist: </Text>
                            <Text>{metadata?.common.artist || 'Unknown'}</Text>
                        </Box>
                        <Box flexDirection="row">
                            <Text color="cyan" bold>Duration: </Text>
                            <Text>{totalProgress || '00:00:00'}</Text>
                        </Box>
                        <Box flexDirection="row">
                            <Text color="cyan" bold>Progress: </Text>
                            <Text color="yellow">{progress || '00:00:00'}</Text>
                        </Box>
                        <Text color="gray">{'-'.repeat(64)}</Text>
                        <Text wrap='truncate-start'><Text color="magenta" bold>Directory: </Text>{currentPath}</Text>
                        <Text><Text color="white" bold>Selected: </Text>"{folder[selectedIndex]}"</Text>
                        <Text><Text color="white" bold>Status: </Text>
                            {status === 0 && <Text color="gray">Music Not Played</Text>}
                            {status === 1 && <Text color="green">Music Is Playing</Text>}
                            {status === 2 && <Text color="red">Music Has Ended</Text>}
                        </Text>
                    </Box>
                    <Box marginLeft={150} padding={1} position='absolute' width={40} height={15} borderStyle={'single'} borderColor={"blue"} flexDirection='column'>
                        <Image
                            key={metadata?.common.title || folder[selectedIndex]}
                            src="./build/background.png"
                        />
                    </Box>


                </Box>
            </TerminalInfoProvider>
        </>
    );
}

function Renderer() {
    CopyAssests();
    clear();
    render(<App />);
}

Renderer();
