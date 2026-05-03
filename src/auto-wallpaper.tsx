import path from "node:path";

export function autoWallpaper() {
    try {
        const defaultImg = path.join(process.cwd(), "build/default.png");
        const backgroundImg = path.join(process.cwd(), "build/background.png");

        // Mengatur wallpaper ke default dulu lalu ke background untuk memicu refresh pada beberapa Desktop Environment
        Bun.spawnSync(["pcmanfm-qt", "--set-wallpaper", defaultImg, "--wallpaper-mode=fit"]);
        Bun.spawnSync(["pcmanfm-qt", "--set-wallpaper", backgroundImg, "--wallpaper-mode=fit"]);
    } catch (err) {
        return err
    }
}