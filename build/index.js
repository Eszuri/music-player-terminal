import React, { useEffect, useState } from 'react';
import { render, Text, useApp, useInput } from 'ink';
import fs from "fs";
import { spawn } from 'child_process';
import path from 'path';
import clear from 'clear';
export default function App() {
    const [folder, setFolder] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentPath, setCurrentPath] = useState('');
    const [status, setStatus] = useState('');
    const rootFolder = "D:/Anime_Ost/";
    const full_path = path.join(rootFolder, currentPath);
    const { exit } = useApp();
    useInput((input, key) => {
        const selectedItem = folder[selectedIndex];
        const targetPath = path.join(full_path, selectedItem);
        if (key.downArrow) {
            setSelectedIndex(prev => (prev + 1) % folder.length);
        }
        if (key.upArrow) {
            setSelectedIndex(prev => (prev - 1 + folder.length) % folder.length);
        }
        if (input == "Enter" || key.return) {
            const checkType = fs.statSync(targetPath);
            if (selectedIndex == 0) {
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
                const playing = spawn('mpv', [
                    // '--no-video',
                    // '--force-window=no',
                    targetPath
                ]);
                playing.stdout.on("data", (data) => {
                    setStatus(data);
                });
                playing.on('close', (code) => {
                    setStatus(`Playing Audio Has Ended (${code})`);
                    setSelectedIndex(selectedIndex + 1);
                    spawn('mpv', [
                        // '--no-video',
                        // '--force-window=no',
                        targetPath
                    ]);
                });
            }
        }
        if (key.escape) {
            exit();
            console.clear();
        }
    });
    useEffect(() => {
        console.clear();
    }, []);
    useEffect(() => {
        fs.readdir(path.join(rootFolder, currentPath), (err, data) => {
            if (err)
                throw err;
            setFolder(['../'].concat(data));
            return data;
        });
    }, [selectedIndex, currentPath]);
    return (React.createElement(React.Fragment, null,
        folder.map((value, index) => (React.createElement(Text, { color: index === selectedIndex ? 'cyan' : undefined, key: index },
            index == selectedIndex ? " ▶️" : "   ",
            " ",
            value))),
        React.createElement(Text, null,
            "Directory: ",
            full_path),
        React.createElement(Text, null,
            "Selected: \"",
            folder[selectedIndex],
            "\""),
        React.createElement(Text, null,
            "Status: ",
            status)));
}
render(React.createElement(App, null));
