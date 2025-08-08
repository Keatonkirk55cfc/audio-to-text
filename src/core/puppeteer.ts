import chalk from "chalk";
import puppeteer, { Browser } from "puppeteer";
import { playAudio } from "./routing";

let browserInstance: Browser | null = null;

/**
 * Gets or creates a Puppeteer browser instance.
 * If a browser instance already exists, it returns that instance.
 * If not, it launches a new browser instance with specific arguments.
 * @returns A Promise that resolves to the Puppeteer browser instance.
 */
async function getOrCreateBrowser(): Promise<Browser> {

    if (!browserInstance) {

        browserInstance = await puppeteer.launch({
            headless: true,
            args: [
                '--use-fake-ui-for-media-stream',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });
    }

    return browserInstance;
}

/**
 * Launches the speech recognition process in the browser.
 * @param files Array of audio file chunks with their paths and start times
 * @param language Language code for the speech recognition
 * @param chunkLength Length of each audio chunk in seconds
 * @returns A Promise that resolves to the final transcript text
 */
export async function launchRecognizer(files: Array<{ path: string, start: number }>, language: string): Promise<string> {

    console.log(chalk.blue("- Launching browser and setting up recognizer..."));

    const browser = await getOrCreateBrowser();

    let transcriptText = "";

    console.log(chalk.yellow("- Playing audio..."));

    for (const file of files) {

        console.log(chalk.green(`- Processing audio chunk: ${file.path} (start: ${file.start}s)`));

        const page = await browser.newPage();

        await page.exposeFunction("playAudio", async () => await playAudio(file.path));

        await page.exposeFunction("log", (c: any) => console.log(c));

        await page.exposeFunction("onSpeechResult", (text: string) => {
            // A space should be added at the beginning to prevent sentences from sticking together
            transcriptText += ` ${text}`;
        });

        await page.exposeFunction("onSpeechError", (e: any) => {
            console.error(chalk.red("Speech recognition error:"), e);
        });

        await page.evaluate(async (language: string) => {

            // @ts-ignore
            const recognition = new window.webkitSpeechRecognition();

            recognition.lang = language;
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event: any) => {

                let finalText = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {

                    // @ts-ignore
                    // window.log(event.results[i][0].transcript);

                    if (event.results[i].isFinal) {
                        finalText += event.results[i][0].transcript;
                    }
                }

                // @ts-ignore
                window.onSpeechResult(finalText);
            };

            recognition.onerror = (e: any) => {

                // @ts-ignore
                window.onSpeechError({
                    name: 'SpeechRecognitionErrorEvent',
                    isTrusted: e.isTrusted,
                    bubbles: e.bubbles,
                    cancelBubble: e.cancelBubble,
                    cancelable: e.cancelable,
                    composed: e.composed,
                    defaultPrevented: e.defaultPrevented,
                    error: e.error,
                    eventPhase: e.eventPhase,
                    message: e.message,
                    returnValue: e.returnValue,
                    timeStamp: e.timeStamp,
                    type: e.type,
                    date: new Date(),
                });
            };

            recognition.start();

            // Wait 500 milliseconds for the page to load and the audio to be ready
            await new Promise((r) => setTimeout(r, 500));

            // @ts-ignore
            await window.playAudio();

            // w
            await new Promise((r) => setTimeout(r, 500));

            recognition.stop();

            await new Promise((r) => setTimeout(r, 500));

        }, language);

        await page.close();
    }

    await closeBrowser();

    return transcriptText.replace(/\s+/g, ' ').trim();
}

/**
 * Closes the Puppeteer browser instance if it exists.
 * Sets the browserInstance to null after closing.
 * @returns A Promise that resolves when the browser is closed.
 */
export async function closeBrowser(): Promise<void> {

    if (browserInstance) {

        await browserInstance.close();
        browserInstance = null;
    }
}
