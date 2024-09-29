
export const splitter = async (event, context) => {

    if (event.httpMethod !== 'POST') {
        throw new Error(`narrateConversation only accepts POST method, you tried: ${event.httpMethod}`);
    }

    const body = JSON.parse(event.body);
    const { text } = body;

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Paragraphs queued for speaker identification.', session_name })
    };
};