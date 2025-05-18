import React, { useEffect, useRef, useState } from 'react';
import { Text, render, Box, useApp, useInput } from 'ink';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import path from 'path';
import clear from 'clear';
import { parseFile } from 'music-metadata';
import { CopyAssests, CopyDefaultImage } from './cp.js';
export default function App() {
    // variabel
    const [folder, setFolder] = useState([]);
    const [metadata, SetMetadata] = useState();
    const [progress, setProgress] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentPath, setCurrentPath] = useState('');
    const [status, setStatus] = useState(0);
    const [trigger, SetTrigger] = useState(false);
    const rootFolder = '/run/media/eszuri/New Volume/Anime_Ost';
    const vlcRef = useRef(null);
    const switchAudioRef = useRef(null);
    const enterTrigger = useRef(false);
    const fullPath = path.join(rootFolder, currentPath);
    const { exit } = useApp();
    // hanlde keyboard
    useInput((input, key) => {
        const selectedItem = folder[selectedIndex];
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
                clear({ fullClear: true });
                setCurrentPath(path.relative(rootFolder, targetPath));
                setSelectedIndex(0);
            }
            if (checkType.isFile()) {
                if (status == 1 && vlcRef.current && switchAudioRef.current) {
                    enterTrigger.current ? enterTrigger.current = true : enterTrigger.current = true;
                    vlcRef.current.kill();
                    SetTrigger(!trigger);
                }
                else {
                    getMetadata();
                    setStatus(1);
                    SetTrigger(!trigger);
                    exec(`gsettings set org.gnome.desktop.background picture-uri-dark "${process.cwd()}/build/background.png"`);
                }
            }
        }
        if (key.escape) {
            if (vlcRef.current == null || vlcRef.current != null) {
                vlcRef.current?.kill();
            }
            ;
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
            if (!picture) {
                return null;
            }
            fs.writeFile('build/background.png', picture.data, (err) => { if (err) {
                console.log('Failed to write image:', err);
                return;
            } });
            return xyz;
        }
        catch (err) {
            return err;
        }
    }
    // eksekusi ketika return lagu
    useEffect(() => {
        if (fullPath != rootFolder) {
            getMetadata();
            setProgress(0);
            switchAudioRef.current = setInterval(() => { setProgress(prev => prev + 1); }, 1000);
            vlcRef.current = spawn('vlc', [
                '--quiet', '--no-video', '--intf', 'dummy', '--play-and-exit',
                fullPath + '/' + folder[selectedIndex]
            ]);
            if (vlcRef.current) {
                vlcRef.current.on('close', () => {
                    if (switchAudioRef.current) {
                        clearInterval(switchAudioRef.current);
                    }
                    if (folder.length == selectedIndex + 1) {
                        vlcRef.current = null;
                        switchAudioRef.current = null;
                        setSelectedIndex(0);
                        setStatus(2);
                        CopyDefaultImage();
                    }
                    else {
                        if (enterTrigger.current == false) {
                            setSelectedIndex(prev => prev + 1);
                        }
                        else {
                            enterTrigger.current = false;
                        }
                        SetTrigger(!trigger);
                    }
                });
            }
        }
    }, [trigger]);
    // mengambil data file lagu
    useEffect(() => {
        fs.readdir(path.join(rootFolder, currentPath), (err, data) => {
            if (err)
                throw err;
            const sorted = data
                .map(f => ({ file: f, mtime: fs.statSync(path.join(fullPath, f)).mtime }))
                .sort((a, b) => a.mtime - b.mtime)
                .map(f => f.file);
            if (fullPath == rootFolder) {
                setFolder(['../', ...sorted]);
            }
            else {
                const filterFileType = ['.mp3', '.ogg', '..wav', '.flac'];
                const x = sorted.filter(item => filterFileType.some(format => item.toLowerCase().endsWith(format)));
                setFolder(['../', ...x]);
            }
        });
    }, [currentPath]);
    // membuat sebuah scroll
    const visibleCount = 25;
    const scrollStart = Math.min(Math.max(selectedIndex - Math.floor(visibleCount / 2), 0), Math.max(folder.length - visibleCount, 0));
    const visibleItems = folder.slice(scrollStart, scrollStart + visibleCount);
    // progress realtime
    const persentase = Math.floor((progress / Number(metadata?.format.duration)) * 100);
    const barProgress = "=".repeat(persentase / 2).padEnd(50, " ");
    return (React.createElement(React.Fragment, null,
        React.createElement(Box, { display: 'flex', width: '100%', minHeight: 15 },
            React.createElement(Box, { width: '100%', borderColor: 'green', borderStyle: 'single', display: 'flex', flexWrap: 'wrap', flexDirection: 'column' }, visibleItems.map((value, idx) => {
                const actualIndex = scrollStart + idx;
                const isSelected = actualIndex === selectedIndex;
                return (React.createElement(Text, { key: actualIndex, color: isSelected ? 'blackBright' : undefined, underline: isSelected }, value));
            })),
            React.createElement(Box, { marginLeft: 80, padding: 1, position: 'absolute', width: 69, borderStyle: 'single', borderColor: "blue", flexDirection: 'column' },
                React.createElement(Text, null,
                    "Name: ",
                    metadata?.common.title),
                React.createElement(Text, null,
                    "Album: ",
                    metadata?.common.album),
                React.createElement(Text, null,
                    "Artist: ",
                    metadata?.common.artist),
                React.createElement(Text, null,
                    "Duration: ",
                    Math.floor(metadata?.format.duration / 60) || 0,
                    " Menit ",
                    Math.floor(metadata?.format.duration || 0 % 60).toString().padStart(2, '0'),
                    " Detik"),
                React.createElement(Text, null,
                    "Progress: ",
                    Math.floor(progress / 60),
                    " Menit : ",
                    Math.floor(progress % 60).toString().padStart(2, '0'),
                    " Detik"),
                React.createElement(Text, null,
                    "[",
                    barProgress,
                    "] ",
                    persentase || 0,
                    "%"),
                React.createElement(Text, null, '-'.repeat(64)),
                React.createElement(Text, { wrap: 'truncate-start' },
                    "Directory: ",
                    currentPath),
                React.createElement(Text, null,
                    "Selected: \"",
                    folder[selectedIndex],
                    "\""),
                React.createElement(Text, null,
                    "Status: ",
                    status == 0 && 'Music Not Played',
                    " ",
                    status == 1 && "Music Is Playing",
                    " ",
                    status == 2 && "Music Has Ended")))));
}
function Renderer() {
    CopyAssests();
    clear();
    render(React.createElement(App, null));
}
Renderer();
