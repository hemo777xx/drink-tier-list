import { getStore } from 'https://cdn.jsdelivr.net/npm/@netlify/blobs/+esm';

class TierListApp {
    constructor() {
        this.state = {
            images: [], // {key, url, tier, order}
            tiers: [
                { id: 'S', name: 'God Tier', color: 'var(--tier-s)' },
                { id: 'A', name: 'Great', color: 'var(--tier-a)' },
                { id: 'B', name: 'Good', color: 'var(--tier-b)' },
                { id: 'C', name: 'Meh', color: 'var(--tier-c)' },
                { id: 'D', name: 'Trash', color: 'var(--tier-d)' }
            ]
        };
        
        // Инициализация Netlify Blob Store
        this.store = getStore({ name: 'drink-tier-list' });
        
        // DOM элементы
        this.dom = {
            uploadZone: document.getElementById('uploadZone'),
            fileInput: document.getElementById('fileInput'),
            tierList: document.getElementById('tierList'),
            libraryGrid: document.getElementById('libraryGrid'),
            emptyState: document.getElementById('emptyState'),
            progressContainer: document.getElementById('progressContainer'),
            progressBarFill: document.getElementById('progressBarFill'),
            progressText: document.getElementById('progressText'),
            clearBtn: document.getElementById('clearBtn'),
            themeToggle: document.getElementById('themeToggle'),
            exportBtn: document.getElementById('exportBtn'),
            shareBtn: document.getElementById('shareBtn'),
            toastContainer: document.getElementById('toastContainer'),
            modal: document.getElementById('tierModal'),
            modalTiers: document.getElementById('modalTiers'),
            closeModalBtn: document.getElementById('closeModalBtn')
        };

        this.draggedItem = null;
        this.touchTimer = null;
        this.saveTimeout = null;
    }

    async init() {
        this.renderTiers();
        this.bindEvents();
        await this.loadImages();
    }

    // --- Работа с хранилищем ---

    async loadImages() {
        try {
            // В Netlify Functions мы будем использовать /api/list
            // Но так как мы на клиенте используем ESM, мы можем напрямую вызвать store.list
            const list = await this.store.list();
            const images = [];
            
            for (const key of list.blobs) {
                if (key === '_tier_data') continue;
                const url = this.store.getURL(key);
                images.push({ key, url: `${url}?v=${Date.now()}`, tier: 'library', order: 0 });
            }

            // Загружаем сохраненные позиции
            try {
                const tierDataStr = await this.store.get('_tier_data');
                if (tierDataStr) {
                    const tierData = JSON.parse(tierDataStr);
                    tierData.items.forEach(item => {
                        const img = images.find(i => i.key === item.key);
                        if (img) {
                            img.tier = item.tier;
                            img.order = item.order;
                        }
                    });
                }
            } catch (e) {
                console.log('No tier data found');
            }

            this.state.images = images;
            this.render();
        } catch (error) {
            console.error('Load error:', error);
            this.showToast('Не удалось загрузить фото. Используется локальное хранилище.', 'error');
            this.loadFromLocalStorage();
        }
    }

    async loadFromLocalStorage() {
        const local = localStorage.getItem('drinkTierList');
        if (local) {
            this.state.images = JSON.parse(local);
            this.render();
        }
    }

    async uploadImage(file) {
        if (!file.type.match(/image\/(jpeg|png|webp)/)) {
            this.showToast('Только JPG, PNG, WebP!', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Файл больше 5 МБ!', 'error');
            return;
        }

        this.dom.progressContainer.hidden = false;
        this.updateProgress(0);

        try {
            // Сжатие и конвертация в WebP
            const webpBlob = await this.compressImage(file);
            const key = `drink_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
            
            // Читаем как ArrayBuffer для Netlify Blobs
            const buffer = await webpBlob.arrayBuffer();
            
            // Симуляция прогресса
            this.updateProgress(50);
            
            // Загрузка в Blob Storage
            await this.store.set(key, buffer, {
                metadata: { contentType: 'image/webp', uploadedAt: new Date().toISOString() }
            });
            
            const url = this.store.getURL(key);
            
            this.state.images.push({ key, url: `${url}?v=${Date.now()}`, tier: 'library', order: 0 });
            this.render();
            this.saveState();
            this.showToast('Фото загружено!', 'success');
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Ошибка загрузки.', 'error');
        } finally {
            this.dom.progressContainer.hidden = true;
        }
    }

    async deleteImage(key) {
        try {
            await this.store.delete(key);
            this.state.images = this.state.images.filter(img => img.key !== key);
            this.render();
            this.saveState();
            this.showToast('Фото удалено.', 'success');
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast('Ошибка удаления.', 'error');
        }
    }

    async saveState() {
        // Debounce сохранения позиций
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            const tierData = {
                items: this.state.images.map(img => ({ key: img.key, tier: img.tier, order: img.order }))
            };
            try {
                await this.store.set('_tier_data', JSON.stringify(tierData));
                localStorage.setItem('drinkTierList', JSON.stringify(this.state.images));
            } catch (error) {
                console.error('Save state error:', error);
            }
        }, 1000);
    }

    // --- Утилиты ---

    async compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxWidth = 1200;
                    let w = img.width, h = img.height;

                    if (w > maxWidth) {
                        h = (maxWidth / w) * h;
                        w = maxWidth;
                    }

                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    updateProgress(percent) {
        this.dom.progressBarFill.style.width = `${percent}%`;
        this.dom.progressText.textContent = `${percent}%`;
    }

    // --- Рендеринг ---

    renderTiers() {
        this.dom.tierList.innerHTML = '';
        this.state.tiers.forEach(tier => {
            const row = document.createElement('div');
            row.className = 'tier-row';
            row.innerHTML = `
                <div class="tier-row__label" style="background-color: ${tier.color}">
                    <span>${tier.id}</span>
                    <small style="font-size: 0.7rem; font-weight: 400;">${tier.name}</small>
                </div>
                <div class="tier-row__content" data-tier="${tier.id}"></div>
            `;
            this.dom.tierList.appendChild(row);
        });
    }

    render() {
        // Очистка
        document.querySelectorAll('.tier-row__content').forEach(c => c.innerHTML = '');
        this.dom.libraryGrid.innerHTML = '';

        const libraryImages = this.state.images.filter(img => img.tier === 'library');
        
        if (this.state.images.length === 0) {
            this.dom.emptyState.style.display = 'block';
        } else {
            this.dom.emptyState.style.display = 'none';
        }

        this.state.images.forEach(img => {
            const card = this.createCard(img);
            if (img.tier === 'library') {
                this.dom.libraryGrid.appendChild(card);
            } else {
                const container = document.querySelector(`.tier-row__content[data-tier="${img.tier}"]`);
                if (container) container.appendChild(card);
            }
        });
    }

    createCard(img) {
        const card = document.createElement('div');
        card.className = 'drink-card';
        card.draggable = true;
        card.dataset.key = img.key;
        card.innerHTML = `
            <img src="${img.url}" loading="lazy" alt="Drink">
            <button class="drink-card__delete"><i class="fas fa-times"></i></button>
        `;
        
        // Drag & Drop
        card.addEventListener('dragstart', (e) => this.handleDragStart(e, img.key));
        card.addEventListener('dragend', this.handleDragEnd.bind(this));
        card.addEventListener('touchstart', (e) => this.handleTouchStart(e, img.key), {passive: true});
        card.addEventListener('touchmove', this.handleTouchMove.bind(this), {passive: false});
        card.addEventListener('touchend', this.handleTouchEnd.bind(this));

        card.querySelector('.drink-card__delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteImage(img.key);
        });

        return card;
    }

    // --- Drag & Drop ---

    handleDragStart(e, key) {
        this.draggedItem = key;
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedItem = null;
    }

    setupDropZones() {
        const zones = [...document.querySelectorAll('.tier-row__content'), this.dom.libraryGrid];
        zones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                const tier = zone.dataset.tier || 'library';
                this.moveToTier(this.draggedItem, tier);
            });
        });
    }

    // --- Touch (Mobile) ---

    handleTouchStart(e, key) {
        this.draggedItem = key;
        this.touchTimer = setTimeout(() => {
            this.dom.modal.classList.add('active');
            this.renderModalTiers();
        }, 500); // Long press
    }

    handleTouchMove(e) {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    handleTouchEnd() {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    renderModalTiers() {
        this.dom.modalTiers.innerHTML = '';
        this.state.tiers.forEach(tier => {
            const btn = document.createElement('button');
            btn.className = 'modal__tier-btn';
            btn.style.backgroundColor = tier.color;
            btn.textContent = tier.id;
            btn.onclick = () => {
                this.moveToTier(this.draggedItem, tier.id);
                this.dom.modal.classList.remove('active');
            };
            this.dom.modalTiers.appendChild(btn);
        });
        
        // Кнопка для библиотеки
        const libBtn = document.createElement('button');
        libBtn.className = 'modal__tier-btn';
        libBtn.style.backgroundColor = 'var(--color-surface-alt)';
        libBtn.innerHTML = '<i class='fas fa-images'></i>';
        libBtn.onclick = () => {
            this.moveToTier(this.draggedItem, 'library');
            this.dom.modal.classList.remove('active');
        };
        this.dom.modalTiers.appendChild(libBtn);
    }

    // --- Actions ---

    moveToTier(key, tier) {
        const img = this.state.images.find(i => i.key === key);
        if (img) {
            img.tier = tier;
            this.render();
            this.saveState();
        }
    }

    clearAll() {
        if (confirm('Удалить все фото и сбросить тир-лист?')) {
            this.state.images.forEach(async (img) => {
                if (!img.key.startsWith('local_')) await this.store.delete(img.key);
            });
            this.store.delete('_tier_data');
            localStorage.removeItem('drinkTierList');
            this.state.images = [];
            this.render();
            this.showToast('Всё очищено!', 'success');
        }
    }

    toggleTheme() {
        document.documentElement.classList.toggle('dark-theme');
        document.documentElement.classList.toggle('light-theme');
        const icon = this.dom.themeToggle.querySelector('i');
        if (document.documentElement.classList.contains('light-theme')) {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    exportToPNG() {
        this.showToast('Генерация изображения...', 'success');
        html2canvas(this.dom.tierList, { backgroundColor: null }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'drink-tier-list.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    async share() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: '🍺 Drink Tier List',
                    text: 'Посмотри мой тир-лист напитков!',
                    url: window.location.href
                });
            } catch (err) {}
        } else {
            this.showToast('Web Share не поддерживается.', 'error');
        }
    }

    showToast(message, type = '') {
        const toast = document.createElement('div');
        toast.className = `toast ${type ? 'toast--' + type : ''}`;
        toast.textContent = message;
        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- Events ---

    bindEvents() {
        // Upload
        this.dom.uploadZone.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => this.uploadImage(file));
        });

        this.dom.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dom.uploadZone.classList.add('dragover');
        });
        this.dom.uploadZone.addEventListener('dragleave', () => this.dom.uploadZone.classList.remove('dragover'));
        this.dom.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dom.uploadZone.classList.remove('dragover');
            Array.from(e.dataTransfer.files).forEach(file => this.uploadImage(file));
        });

        // Actions
        this.dom.clearBtn.addEventListener('click', () => this.clearAll());
        this.dom.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.dom.exportBtn.addEventListener('click', () => this.exportToPNG());
        this.dom.shareBtn.addEventListener('click', () => this.share());
        this.dom.closeModalBtn.addEventListener('click', () => this.dom.modal.classList.remove('active'));

        this.setupDropZones();
    }
}

// Инициализация
const app = new TierListApp();
app.init();