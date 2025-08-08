import { execSync } from 'child_process';
import path from 'path';
import fs, { existsSync } from 'fs';
import chalk from 'chalk';

/**
 * Checks if the given file is a valid audio file by using ffprobe.
 * It checks for audio streams in the file.
 * @param filePath Path to the audio file
 * @returns true if the file is an audio file, false otherwise
 */
function isAudioFile(filePath: string): boolean {
    try {
        const output = execSync(`ffprobe -v error -show_streams -select_streams a -of json "${filePath}"`).toString().trim();
        const result = JSON.parse(output);

        // If there are audio streams, the file is an audio file
        return result.streams && result.streams.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Prepares the audio directory for storing audio chunks.
 * @param filePath Path to the audio file
 * @returns The directory for the audio file
 */
function prepareAudio(filePath: string): string {
    if (!existsSync(filePath)) {
        throw new Error(chalk.red(`Audio file not found: ${filePath}`));
    }

    if (!isAudioFile(filePath)) {
        throw new Error(chalk.red(`File is not a valid audio format: ${filePath}`));
    }

    const baseName = path.basename(filePath);

    const tmpDirectory = path.join('/tmp', 'audio-to-text');
    if (!fs.existsSync(tmpDirectory)) fs.mkdirSync(tmpDirectory);

    const audioDirectory = path.join(tmpDirectory, baseName);
    if (!fs.existsSync(audioDirectory)) fs.mkdirSync(audioDirectory);

    return audioDirectory;
}

/**
 * Get duration of the audio file
 * @param filePath Path to the audio file
 * @returns Duration of the audio file in seconds
 */
function getAudioDuration(filePath: string): number {
    const duration = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`).toString().trim();
    return Math.ceil(Number(duration));
}

/**
 * Splits the audio file into chunks.
 * @param filePath Path to the audio file
 * @param chunkLength Length of each chunk in seconds
 * @returns An array of objects containing the path and start time of each chunk
 */
export function splitAudioToChunks(filePath: string, chunkLength: number): Array<{ path: string, start: number }> {

    const audioDirectory = prepareAudio(filePath);

    const duration = getAudioDuration(filePath);

    const chunks: Array<{ path: string, start: number }> = [];

    // Split audio into 5-second wav chunks
    for (let start = 0; start < duration; start += chunkLength) {

        const chunkPath = path.join(audioDirectory, `${start}-${start + chunkLength}.wav`);

        execSync(`ffmpeg -y -i "${filePath}" -ss ${start} -t ${chunkLength} -ar 16000 -ac 1 "${chunkPath}"`, { stdio: 'ignore' });

        chunks.push({
            path: chunkPath,
            start
        });
    }

    return chunks;
}

/**
 * Removes the audio directory and all its contents for a given audio file.
 * @param filePath Path to the original audio file
 */
export function removeAudioDirectory(filePath: string): void {
    const audioDirectory = prepareAudio(filePath);
    if (fs.existsSync(audioDirectory)) {
        fs.rmSync(audioDirectory, { recursive: true, force: true });
    }
}
