import path from "path";
import fs from "fs";

const PROJECT_ROOT = path.resolve(import.meta.dir, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');

export async function CopyAssets() {
    try {
        if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
        const src = path.join(PROJECT_ROOT, 'src/default.png');
        const dest = path.join(BUILD_DIR, 'default.png');
        fs.writeFileSync(dest, fs.readFileSync(src));
    } catch (err) {
        return err;
    }
}

export async function CopyDefaultImage() {
    try {
        const src = path.join(BUILD_DIR, 'default.png');
        const dest = path.join(BUILD_DIR, 'background.png');
        fs.writeFileSync(dest, fs.readFileSync(src));
    } catch (err) {
        return err;
    }
}
