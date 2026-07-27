import { getStore } from '@netlify/blobs';
import Busboy from 'busboy';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const store = getStore({ name: process.env.BLOB_STORE_NAME || 'drink-tier-list' });
    
    return new Promise((resolve) => {
        const busboy = Busboy({ headers: event.headers });
        let buffer = [];
        let fileType = '';

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            fileType = mimetype;
            file.on('data', (data) => buffer.push(data));
        });

        busboy.on('finish', async () => {
            const buf = Buffer.concat(buffer);
            if (buf.length > 5 * 1024 * 1024) {
                return resolve({ statusCode: 413, body: JSON.stringify({ error: 'File too large' }) });
            }

            const key = `drink_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
            
            try {
                await store.set(key, buf, { metadata: { contentType: fileType } });
                const url = store.getURL(key);
                resolve({
                    statusCode: 200,
                    body: JSON.stringify({ success: true, url, key })
                });
            } catch (error) {
                resolve({ statusCode: 507, body: JSON.stringify({ error: 'Storage error' }) });
            }
        });

        busboy.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        busboy.end();
    });
};
