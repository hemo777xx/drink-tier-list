import { getStore } from '@netlify/blobs';
import busboy from 'busboy';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const store = getStore({
            name: process.env.BLOB_STORE_NAME || 'drink-tier-list',
            siteID: process.env.SITE_ID,
            token: process.env.BLOB_STORE_TOKEN
        });

        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Expected multipart/form-data' })
            };
        }

        const bb = busboy({ 
            headers: { 'content-type': contentType },
            limits: { fileSize: 5 * 1024 * 1024 }
        });
        
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

            bb.on('close', () => {
                if (!fileBuffer || !filename) {
                    reject(new Error('No file uploaded'));
                    return;
                }
                resolve();
            });

            bb.on('error', reject);
            
            if (event.isBase64Encoded) {
                const buffer = Buffer.from(event.body, 'base64');
                bb.end(buffer);
            } else {
                bb.end(event.body);
            }
        });

        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const key = `drink_${timestamp}_${randomStr}.webp`;

        // СОХРАНЯЕМ ФАЙЛ
        await store.set(key, fileBuffer, {
            metadata: {
                contentType: 'image/webp',
                uploadedAt: new Date().toISOString(),
                originalName: filename
            }
        });

        // Проверяем, что файл действительно сохранился
        try {
            const check = await store.get(key);
            if (!check) {
                throw new Error('File not found after save');
            }
        } catch (checkError) {
            console.error('Save verification failed:', checkError);
            // Продолжаем, но логируем
        }

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
