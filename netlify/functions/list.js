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
        const blobs = list.blobs || [];

        // Загружаем данные о тирах (если есть)
        let tierMap = {};
        try {
            const tierDataStr = await store.get('_tier_data');
            if (tierDataStr) {
                const parsed = JSON.parse(tierDataStr);
                if (parsed.items) {
                    parsed.items.forEach(item => {
                        tierMap[item.key] = { tier: item.tier, order: item.order };
                    });
                }
            }
        } catch (e) {
            // Нет данных о тирах — просто игнорируем
            console.log('No tier data found, using defaults');
        }

        for (const key of blobs) {
            if (key === '_tier_data') continue;
            
            // Получаем метаданные для каждого файла
            let metadata = {};
            try {
                const meta = await store.get(key, { metadata: true });
                metadata = meta?.metadata || {};
            } catch (e) {
                // Если метаданные не доступны — просто игнорируем
            }
            
            const url = `/.netlify/blobs/${process.env.BLOB_STORE_NAME || 'drink-tier-list'}/${key}`;
            const tierInfo = tierMap[key] || { tier: 'library', order: 0 };

            items.push({
                key: key,
                url: url,
                tier: tierInfo.tier,
                order: tierInfo.order || 0,
                metadata: metadata
            });
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items })
        };

    } catch (error) {
        console.error('List error:', error);
        // Возвращаем пустой список, чтобы не ломать клиент
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [], error: error.message })
        };
    }
};
