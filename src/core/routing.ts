import { exec, execSync } from "child_process";
import chalk from "chalk";

const audioRoutingConfig = {
    speakerDevice: 'virtual_speaker',
    speakerDeviceMonitor: 'virtual_speaker.monitor',
    microphoneDevice: 'virtual_microphone',
    originalDefaultSource: null as string | null,
    modulesList: null as string | null,
    nullSinkModuleId: null as number | null,
    remapSourceModuleId: null as number | null,
};

/**
 * Load the list of loaded modules.
 */
function loadModules(): void {
    audioRoutingConfig.modulesList = execSync('pactl list short modules').toString().trim();
}

/**
 * Get the module ID by name from the list of loaded modules.
 * @param name The name to check for.
 * @returns The module ID if found, otherwise null.
 */
function getModuleIdByName(name: string): number | null {

    if (!audioRoutingConfig.modulesList) {
        loadModules();
    }

    if (audioRoutingConfig.modulesList) {
        const line = audioRoutingConfig.modulesList.split('\n').find(line => line.includes(name));
        if (line) {
            return parseInt(line.split('\t')[0]);
        }
    }

    return null;
}

/**
 * Setup audio routing for virtual microphone and speaker.
 * This function creates a null sink for the speaker and a remap source for the microphone.
 * It also sets the default source to the virtual microphone.
 * @param speakerDevice The name of the virtual speaker device.
 * @param microphoneDevice The name of the virtual microphone device.
 * @returns void
 */
export function setupAudioRouting(
    speakerDevice: string = audioRoutingConfig.speakerDevice,
    microphoneDevice: string = audioRoutingConfig.microphoneDevice
): void {

    audioRoutingConfig.speakerDevice = speakerDevice;
    audioRoutingConfig.microphoneDevice = microphoneDevice;

    // Get and store the original default source (if available)
    audioRoutingConfig.originalDefaultSource = execSync('pactl get-default-source').toString().trim();

    if (audioRoutingConfig.originalDefaultSource) {
        console.log(chalk.cyan(`- Original default source: ${audioRoutingConfig.originalDefaultSource}`));
    } else {
        console.log(chalk.yellow("- No original default source detected."));
    }

    audioRoutingConfig.speakerDeviceMonitor = `${audioRoutingConfig.speakerDevice}.monitor`;

    // Check for null-sink by sink_name and get its id
    audioRoutingConfig.nullSinkModuleId = getModuleIdByName(`sink_name=${audioRoutingConfig.speakerDevice}`);

    if (audioRoutingConfig.nullSinkModuleId == null) {
        console.log(chalk.blue("- Loading module-null-sink..."));
        audioRoutingConfig.nullSinkModuleId = parseInt(execSync(`pactl load-module module-null-sink sink_name=${audioRoutingConfig.speakerDevice}`).toString().trim());
    }

    // Check for remap-source by source_name and get its id
    audioRoutingConfig.remapSourceModuleId = getModuleIdByName(`source_name=${audioRoutingConfig.microphoneDevice}`);

    if (audioRoutingConfig.remapSourceModuleId == null) {
        console.log(chalk.blue("- Loading module-remap-source..."));
        audioRoutingConfig.remapSourceModuleId = parseInt(execSync(`pactl load-module module-remap-source master=${audioRoutingConfig.speakerDeviceMonitor} source_name=${audioRoutingConfig.microphoneDevice}`).toString().trim());
    }

    if (audioRoutingConfig.microphoneDevice != audioRoutingConfig.originalDefaultSource) {
        console.log(chalk.blue(`- Setting default source to ${audioRoutingConfig.microphoneDevice}...`));
        execSync(`pactl set-default-source ${audioRoutingConfig.microphoneDevice}`);
    }

    console.log(chalk.green("✔ Virtual speaker and microphone setup complete."));
}

/**
 * Play audio using the configured virtual speaker device.
 * @param filePath The path to the audio file to play.
 * @returns Promise<void>
 */
export async function playAudio(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`paplay --device=${audioRoutingConfig.speakerDevice} "${filePath}"`, (error) => {
            if (error) {
                console.error(chalk.red("- Error playing audio:"), error);
                reject(error);
            } else {
                console.log(chalk.green("✔ Audio playback finished."));
                resolve();
            }
        });
    });
}

/**
 * Restore audio routing by restoring the original default source and unloading virtual modules.
 * @returns void
 */
export function restoreAudioRouting() {

    // Restore the original default source if it exists
    if (audioRoutingConfig.originalDefaultSource) {
        execSync(`pactl set-default-source ${audioRoutingConfig.originalDefaultSource}`);
        console.log(chalk.cyan(`- Restored original default source: ${audioRoutingConfig.originalDefaultSource}`));
    }

    // must be reloaded to ensure the latest state
    loadModules();

    // Unload remap-source module if loaded
    if (
        audioRoutingConfig.remapSourceModuleId != null &&
        getModuleIdByName(`${audioRoutingConfig.remapSourceModuleId}\tmodule-remap-source\tmaster=${audioRoutingConfig.speakerDeviceMonitor} source_name=${audioRoutingConfig.microphoneDevice}`)

    ) {
        execSync(`pactl unload-module ${audioRoutingConfig.remapSourceModuleId}`);
        console.log(chalk.cyan(`- Unloaded module-remap-source: ${audioRoutingConfig.remapSourceModuleId}`));
        audioRoutingConfig.remapSourceModuleId = null;
    }

    // must be reloaded to ensure the latest state
    loadModules();

    // Unload null-sink module if loaded
    if (
        audioRoutingConfig.nullSinkModuleId != null &&
        getModuleIdByName(`${audioRoutingConfig.nullSinkModuleId}\tmodule-null-sink\tsink_name=${audioRoutingConfig.speakerDevice}`)
    ) {
        execSync(`pactl unload-module ${audioRoutingConfig.nullSinkModuleId}`);
        console.log(chalk.cyan(`- Unloaded module-null-sink: ${audioRoutingConfig.nullSinkModuleId}`));
        audioRoutingConfig.nullSinkModuleId = null;
    }
}
