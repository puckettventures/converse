// utils/backoff.mjs
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const exponentialBackoff = async (fn, maxRetries = 10, baseDelay = 1000, maxDelay = 60000, jitterFactor = 0.2) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            const statusCode = error.status || error.statusCode;
            if (statusCode === 429) { // OpenAI's rate limiting
                attempt++;
                let delay;

                // If retry-after header exists, use that
                const retryAfter = error.headers?.['retry-after'] || error.headers?.['retry-after-ms'];
                if (retryAfter) {
                    delay = parseInt(retryAfter) * (retryAfter.endsWith('ms') ? 1 : 1000);
                    delay += Math.random() * jitterFactor * delay; // Add jitter
                } else {
                    delay = Math.min(baseDelay * (2 ** attempt), maxDelay) + Math.random() * jitterFactor * 1000; 
                }
                
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached');
};

export default exponentialBackoff;
