'use server';

import fs from 'fs';
import path from 'path';

export interface MediaPreset {
    name: string;
    path: string;
}

export async function getMediaPresets(): Promise<MediaPreset[]> {
    try {
        const mediaDir = path.join(process.cwd(), 'public', 'media');

        // Check if directory exists
        if (!fs.existsSync(mediaDir)) {
            return [];
        }

        const files = await fs.promises.readdir(mediaDir);

        // Filter for video files
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return videoExtensions.includes(ext);
        });

        // Map to presets
        return videoFiles.map(file => ({
            name: file.replace(/\.[^/.]+$/, "").replace(/-/g, " "), // Remove extension and replace dashes with spaces
            path: `/media/${file}`
        }));
    } catch (error) {
        console.error('Error reading media presets:', error);
        return [];
    }
}
