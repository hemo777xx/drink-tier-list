import { getStore } from '@netlify/blobs';
import busboy from 'busboy';

export const handler = async (event) => {
    // Проверяем метод
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // ЯВНО передаём siteID и token из переменных окружения
        const store = getStore({
            name: process.env.BLOB_STORE_NAME || 'drink-tier-list',
            siteID: process.env.SITE_ID,      // Автоматически доступна в Netlify
            token: process.env.BLOB_STORE_TOKEN
        });

        // Парсинг multipart/form-data
        const contentType = event.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Expected multipart/form-data' })
            };
        }

        const bb = busboy({ headers: { 'content-type': contentType } });
        let fileBuffer = null;
        let filename = null;

        await new Promise((resolve, reject) => {
            bb.on('file', (name, file, info) => {
                filename = info.filename;
                const chunks = [];
                file.on('data', (data) => chunks.push(data));
                file.on('end', () => {
                    fileBuffer = Buffer.concat(chunks);
                });
            });
            bb.on('close', resolve);
            bb.on('error', reject);
            bb.end(event.body);
        });

        if (!fileBuffer || !filename) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No file uploaded' })
            };
        }

        // Генерируем уникальное имя
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const key = `drink_${timestamp}_${randomStr}.webp`;

        // Сохраняем в Blob Storage
        await store.set(key, fileBuffer, {
            metadata: {
                contentType: 'image/webp',
                uploadedAt: new Date().toISOString(),
                originalName: filename
            }
        });

        // Формируем публичный URL
        const url = `/.netlify/blobs/${process.env.BLOB_STORE_NAME || 'drink-tier-list'}/${key}`;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                key: key,
                url: url
            })
        };

    } catch (error) {
        console.error('Upload error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
