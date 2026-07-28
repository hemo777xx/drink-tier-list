import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    if (event.httpMethod !== 'DELETE') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { key } = JSON.parse(event.body || '{}');
        
        if (!key) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing key' })
            };
        }

        const store = getStore({
            name: process.env.BLOB_STORE_NAME || 'drink-tier-list',
            siteID: process.env.SITE_ID,
            token: process.env.BLOB_STORE_TOKEN
        });

        await store.delete(key);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Delete error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
