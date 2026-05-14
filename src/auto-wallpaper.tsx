import path from "node:path";

const PROJECT_ROOT = path.resolve(import.meta.dir, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, "build");
const DEFAULT_IMG = path.join(BUILD_DIR, "default.png");

export function autoWallpaper(customImgPath?: string) {
    try {
        const backgroundImg = customImgPath || path.join(BUILD_DIR, "background.png");

        if (process.platform === 'win32') {
            // Windows Wallpaper change using PowerShell
            const setWallpaper = (imgPath: string) => {
                const command = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Wallpaper { [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }'; [Wallpaper]::SystemParametersInfo(20, 0, "${imgPath}", 3)`;
                Bun.spawnSync(["powershell", "-Command", command]);
            };
            // Set ke default dulu untuk trigger refresh (opsional, tapi terkadang membantu)
            // setWallpaper(DEFAULT_IMG); 
            setWallpaper(backgroundImg);
        } else {
            // Linux (assuming pcmanfm-qt as per original code)
            try {
                Bun.spawnSync(["pcmanfm-qt", "--set-wallpaper", DEFAULT_IMG, "--wallpaper-mode=fit"]);
                Bun.spawnSync(["pcmanfm-qt", "--set-wallpaper", backgroundImg, "--wallpaper-mode=fit"]);
            } catch (e) {
                // Ignore if pcmanfm-qt is not available
            }
        }
    } catch (err) {
        return err
    }
}