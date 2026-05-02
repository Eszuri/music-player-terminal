import { execSync } from "node:child_process";
import path from "node:path";

export function autoWallpaper() {
    try {
        const defaultImg = path.join(process.cwd(), "build/default.png");
        const backgroundImg = path.join(process.cwd(), "build/background.png");

        // For Linux (LXQt Desktop Environment)
        execSync(`pcmanfm-qt --set-wallpaper "${defaultImg}" --wallpaper-mode=fit`);
        execSync(`pcmanfm-qt --set-wallpaper "${backgroundImg}" --wallpaper-mode=fit`);
    } catch (err) {
        console.error("Gagal mengganti wallpaper")
    }
}
