import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    const store = getStore({ name: process.env.BLOB_STORE_NAME || 'drink-tier-list' });
    const data = JSON.parse(event.body);

    try {
        await store.set('_tier_data', JSON.stringify(data));
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
