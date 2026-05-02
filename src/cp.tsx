import { copyFileSync } from "fs";
import path from "path";

export function CopyAssests() {
    try {
        copyFileSync(path.join(process.cwd(), 'src/default.png'), path.join(process.cwd(), 'build/default.png'));
    } catch (err) {
        console.error("Failed to copy assets:", err);
    }
}

export function CopyDefaultImage() {
    try {
        copyFileSync(path.join(process.cwd(), 'build/default.png'), path.join(process.cwd(), 'build/background.png'));
    } catch (err) {
        console.error("Failed to copy default image:", err);
    }
}
