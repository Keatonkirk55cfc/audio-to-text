import { launchRecognizer } from './puppeteer';
import { setupAudioRouting, restoreAudioRouting } from './routing';
import { removeAudioDirectory, splitAudioToChunks } from './audio';

/**
 * Transcribes an audio file to text using the browser's speech recognition capabilities.
 * It splits the audio file into chunks, sets up audio routing, and launches a browser to perform the transcription.
 * @param filePath Path to the audio file to transcribe
 * @param options Transcription options
 * @returns A Promise that resolves to the transcribed text
 */
export async function transcribeFromFile(
    filePath: string,
    options?: {
        language?: string;
        speakerDevice?: string;
        microphoneDevice?: string;
    }
): Promise<string> {

    const chunkLength = 5; // seconds

    const files = splitAudioToChunks(filePath, chunkLength);

    const language = options?.language || 'en-US';

    setupAudioRouting(options?.speakerDevice, options?.microphoneDevice);

    // Ensure restore audio routing and remove audio directory and exit
    process.on('SIGINT', () => process.exit());
    process.on('SIGTERM', () => process.exit());
    process.on('exit', () => {

        removeAudioDirectory(filePath);
        restoreAudioRouting();
    });

    const text = await launchRecognizer(files, language);

    return text;
}
