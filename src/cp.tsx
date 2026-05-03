import path from "path";

export async function CopyAssests() {
    try {
        const src = path.join(process.cwd(), 'src/default.png');
        const dest = path.join(process.cwd(), 'build/default.png');
        await Bun.write(dest, Bun.file(src));
    } catch (err) {
        console.error("Failed to copy assets:", err);
    }
}

export async function CopyDefaultImage() {
    try {
        const src = path.join(process.cwd(), 'build/default.png');
        const dest = path.join(process.cwd(), 'build/background.png');
        await Bun.write(dest, Bun.file(src));
    } catch (err) {
        console.error("Failed to copy default image:", err);
    }
}
