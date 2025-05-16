import React, {useEffect, useState} from 'react';
import {render, Text, useApp, useInput} from 'ink';
import fs from 'fs';
import {spawn} from 'child_process';
import path from 'path';
import clear from 'clear';

export default function App() {
    const [folder, setFolder] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [currentPath, setCurrentPath] = useState('');
    const [status, setStatus] = useState('');
    const [trigger, SetTrigger] = useState<boolean>(false)
    const rootFolder = '/run/media/eszuri/New Volume/Anime_Ost';
    const fullPath = path.join(rootFolder, currentPath);
    const {exit} = useApp();

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
                SetTrigger(!trigger)
                setTimeout(() => {
                    setSelectedIndex(prev => prev + 1)
                }, 100)
            }
        }

        if (key.escape) {
            exit();
            console.clear();
        }
    });


    useEffect(() => {
        if (fullPath != rootFolder) {
            spawn('vlc', ['--quiet', '--no-video', '--intf', 'dummy', '--play-and-exit',
                fullPath + '/' + folder[selectedIndex]]).on('close', (x) => {
                    if (folder.length == selectedIndex + 1) {
                        setSelectedIndex(0)
                    } else {
                        SetTrigger(!trigger);
                    }
                    setSelectedIndex(prev => prev + 1)
                    setStatus('play now' + x)
                })
        } else {
            setStatus('')
        }
    }, [trigger])


    useEffect(() => {
        fs.readdir(path.join(rootFolder, currentPath), (err, data) => {
            if (err) throw err;

            const sorted = data
                .map(f => ({
                    file: f,
                    mtime: fs.statSync(path.join(fullPath, f)).mtime
                }))
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

    return (
        <>
            {folder.map((value, index) => (
                <Text color={index === selectedIndex ? 'cyan' : undefined} key={index}>
                    {index === selectedIndex ? ' ▶️' : '   '} {value}
                </Text>
            ))}
            <Text>Directory: {fullPath}</Text>
            <Text>Selected: "{folder[selectedIndex]}"</Text>
            <Text>Status: {status}</Text>
        </>
    );
}

render(<App />);

