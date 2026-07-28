import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
    try {
        const store = getStore({
            name: process.env.BLOB_STORE_NAME || 'drink-tier-list',
            siteID: process.env.SITE_ID,
            token: process.env.BLOB_STORE_TOKEN
        });

        // Получаем список всех файлов
        const list = await store.list();
        const items = [];

        for (const key of list.blobs) {
            if (key === '_tier_data') continue;
            
            // Получаем метаданные для каждого файла
            const meta = await store.get(key, { metadata: true });
            const url = `/.netlify/blobs/${process.env.BLOB_STORE_NAME || 'drink-tier-list'}/${key}`;
            
            // Пытаемся получить tier из отдельного хранилища, если есть
            let tierData = {};
            try {
                const tierDataStr = await store.get('_tier_data');
                if (tierDataStr) {
                    const parsed = JSON.parse(tierDataStr);
                    const found = parsed.items.find(item => item.key === key);
                    if (found) {
                        tierData = { tier: found.tier, order: found.order };
                    }
                }
            } catch (e) {
                // Нет данных о тирах — игнорируем
            }

            items.push({
                key: key,
                url: url,
                tier: tierData.tier || 'library',
                order: tierData.order || 0,
                metadata: meta?.metadata || {}
            });
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        };

    } catch (error) {
        console.error('List error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
