import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    const store = getStore({ name: process.env.BLOB_STORE_NAME || 'drink-tier-list' });
    
    try {
        const list = await store.list();
        const items = [];
        
        for (const blob of list.blobs) {
            if (blob === '_tier_data') continue;
            const url = store.getURL(blob);
            items.push({
                key: blob,
                url: `${url}?v=${Date.now()}`
            });
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ items })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
