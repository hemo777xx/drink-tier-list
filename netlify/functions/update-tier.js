import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { items } = JSON.parse(event.body || '{}');
        
        if (!items || !Array.isArray(items)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing items array' })
            };
        }

        const store = getStore({
            name: process.env.BLOB_STORE_NAME || 'drink-tier-list',
            siteID: process.env.SITE_ID,
            token: process.env.BLOB_STORE_TOKEN
        });

        // Сохраняем данные о тирах
        await store.set('_tier_data', JSON.stringify({ items }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Update tier error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
