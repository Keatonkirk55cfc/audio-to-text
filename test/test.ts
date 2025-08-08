import { transcribeFromFile } from '../src';
import path from 'path';
import chalk from 'chalk';

async function runTest() {

    const filePath = path.resolve('./example.ogg');
    const speakerDevice = 'virtual_speaker';
    const microphoneDevice = 'virtual_microphone';

    try {
        console.log(chalk.blue("- Starting transcription test...\n"));

        const result = await transcribeFromFile(filePath, {
            language: 'fa-IR', // or 'en-US', for example
            speakerDevice,
            microphoneDevice
        });

        console.log(chalk.green("📝 Final Transcript:\n"));
        console.log(result || chalk.yellow('- [No text captured]'));
    } catch (err) {
        console.error(chalk.red("❌ Test failed:"), err);
    }
}

runTest();
