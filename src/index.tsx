import React, {useEffect, useRef, useState} from 'react';
import {Text, render, Box, useApp, useInput} from 'ink';
import fs from 'fs';
import {ChildProcess, exec, spawn} from 'child_process';
import path from 'path';
import clear from 'clear';
import {IAudioMetadata, parseFile} from 'music-metadata';
import {CopyAssests, CopyDefaultImage} from './cp.js';

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
    const rootFolder = path.join(process.cwd(), "../../../../Anime_Ost");
    const vlcRef = useRef<ChildProcess | null>(null);
    const enterTrigger = useRef(false);
    const fullPath = path.join(rootFolder, currentPath);
    const {exit} = useApp();

    // hanlde keyboard
    useInput((input, key) => {
        const selectedItem: any = folder[selectedIndex];
        const targetPath = path.join(fullPath, selectedItem);

        if (key.downArrow) {
            setSelectedIndex(prev => (prev + 1) % folder.length);
        }

        if (key.upArrow) {
            setSelectedIndex(prev => (prev - 1 + folder.length) % folder.length);
        }

        if (input === 'Enter' || key.return) {
            const checkType = fs.statSync(targetPath);

            if (selectedIndex === 0) {
                const parent = path.dirname(currentPath);
                setCurrentPath(path.relative(rootFolder, path.join(rootFolder, parent)));
                return;
            }

            if (checkType.isDirectory()) {
                clear({fullClear: true});
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
                    exec(`gsettings set org.gnome.desktop.background picture-uri-dark "${process.cwd()}/build/background.png"`)

                }
            }
        }

        if (key.escape) {
            if (vlcRef.current == null || vlcRef.current != null) {vlcRef.current?.kill()};
            CopyDefaultImage();
            exit();
            console.clear();
        }
    });


    // function untuk save image dan set wallpaper
    async function getMetadata() {
        try {
            const xyz = await parseFile(fullPath + "/" + folder[selectedIndex]);
            SetMetadata(xyz);
            const picture = xyz.common.picture?.[0];
            if (!picture) {return null;}
            fs.writeFile('build/background.png', picture.data, (err) => {if (err) {console.log('Failed to write image:', err); return;} });
            return xyz;
        } catch (err) {return err;}
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
                    console.error('Error polling status:', err);
                    console.clear()
                }
            }, 500);  // update setiap 1 detik


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
        }
    }, [trigger])


    // mengambil data file lagu
    useEffect(() => {
        fs.readdir(path.join(rootFolder, currentPath), (err, data) => {
            if (err) throw err;
            const sorted = data
                .map(f => ({file: f, mtime: fs.statSync(path.join(fullPath, f)).mtime}))
                .sort((a: any, b: any) => a.mtime - b.mtime)
                .map(f => f.file);
            if (fullPath == rootFolder) {
                setFolder(['../', ...sorted]);
            } else {
                const filterFileType = ['.mp3', '.ogg', '..wav', '.flac']
                const x = sorted.filter(item => filterFileType.some(format => item.toLowerCase().endsWith(format)))
                setFolder(['../', ...x])
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
            <Box display='flex' width={'100%'} minHeight={15}>
                <Box width={'100%'} borderColor={'green'} borderStyle={'single'} display='flex' flexWrap='wrap' flexDirection='column'>
                    {visibleItems.map((value, idx) => {
                        const actualIndex = scrollStart + idx;
                        const isSelected = actualIndex === selectedIndex;
                        return (<Text key={actualIndex} color={isSelected ? 'blackBright' : undefined} underline={isSelected}>{value}</Text>);
                    })}
                </Box>
                <Box marginLeft={80} padding={1} position='absolute' width={69} borderStyle={'single'} borderColor={"blue"} flexDirection='column'>
                    <Text>Name: {metadata?.common.title}</Text>
                    <Text>Album: {metadata?.common.album}</Text>
                    <Text>Artist: {metadata?.common.artist}</Text>
                    <Text>Duration: {totalProgress}</Text>
                    <Text>Progress: {progress}</Text>
                    <Text>{'-'.repeat(64)}</Text>
                    <Text wrap='truncate-start'>Directory: {currentPath}</Text>
                    <Text>Selected: "{folder[selectedIndex]}"</Text>
                    <Text>Status: {status == 0 && 'Music Not Played'} {status == 1 && "Music Is Playing"} {status == 2 && "Music Has Ended"}</Text>
                </Box>


            </Box>
        </>
    );
}

function Renderer() {
    CopyAssests();
    clear();
    render(<App />)
}
Renderer();
