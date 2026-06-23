import puppeteer from 'puppeteer';

/**
 * Automates ChatGPT web UI using Puppeteer and the user's session cookie.
 * Generates an image using DALL-E 3 (built-in to the user's Plus subscription)
 * and returns it as a base64 Data URL.
 */
export async function generateImageWithChatGPT(prompt: string, aspect: string): Promise<string> {
    const sessionToken = process.env.CHATGPT_SESSION_TOKEN;
    if (!sessionToken) {
        throw new Error('CHATGPT_SESSION_TOKEN environment variable is not configured.');
    }

    // Launch headless Chromium browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        // Set the viewport to a standard desktop screen
        await page.setViewport({ width: 1280, height: 800 });

        // Set the session cookie for chatgpt.com
        await page.setCookie({
            name: '__Secure-next-auth.session-token',
            value: sessionToken,
            domain: '.chatgpt.com',
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
        });

        // Navigate to the clean ChatGPT start page
        await page.goto('https://chatgpt.com/', { waitUntil: 'networkidle2' });

        // Wait for the prompt textarea to load
        const textareaSelector = '#prompt-textarea';
        await page.waitForSelector(textareaSelector, { timeout: 20000 });

        // Craft the prompt to instruct ChatGPT to output the image directly
        const fullPrompt = `Please generate an image of: ${prompt}. Aspect ratio: ${aspect}. Draw the image now without asking any follow-up questions.`;

        // Type the prompt into the input field
        await page.type(textareaSelector, fullPrompt);

        // Press Enter to submit the prompt
        await page.keyboard.press('Enter');

        // Wait for the image element containing the generated file URL to appear.
        // ChatGPT DALL-E outputs are hosted on files.oaiusercontent.com.
        const imgSelector = 'img[src*="files.oaiusercontent.com"]';
        await page.waitForSelector(imgSelector, { timeout: 90000 });

        // Retrieve the source URL of the generated image
        const imageUrl = await page.evaluate((selector) => {
            const imgs = Array.from(document.querySelectorAll(selector)) as HTMLImageElement[];
            if (imgs.length === 0) return null;
            // Get the latest generated image
            return imgs[imgs.length - 1].src;
        }, imgSelector);

        if (!imageUrl) {
            throw new Error('Failed to extract the generated image URL from ChatGPT.');
        }

        // Fetch the image binary and convert it to base64
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
            throw new Error(`Failed to download image from ChatGPT storage (${imgRes.status}).`);
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return `data:image/png;base64,${buf.toString('base64')}`;

    } finally {
        await browser.close();
    }
}
