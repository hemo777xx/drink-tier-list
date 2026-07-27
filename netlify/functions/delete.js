import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    const store = getStore({ name: process.env.BLOB_STORE_NAME || 'drink-tier-list' });
    const { key } = JSON.parse(event.body);

    try {
        // Проверка существования
        const meta = await store.getMetadata(key);
        if (!meta) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
        
        await store.delete(key);
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
