// storage.js — LocalStorage操作 & ユーティリティ

const Storage = {
  KEYS: {
    BOOKS: 'books',
    PRE_READING_QUESTIONS: 'preReadingQuestions',
    CHAPTER_NOTES: 'chapterNotes',
    ACTION_ITEMS: 'actionItems',
    READING_CYCLES: 'readingCycles',
    JOURNAL_ENTRIES: 'journalEntries',
  },

  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  getAll(key) {
    return this.get(key) || [];
  },

  init() {
    Object.values(this.KEYS).forEach(key => {
      if (this.get(key) === null) {
        this.save(key, []);
      }
    });
  },

  // CRUD helpers
  addItem(key, item) {
    const items = this.getAll(key);
    items.push(item);
    this.save(key, items);
    return item;
  },

  updateItem(key, id, updates) {
    const items = this.getAll(key);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: nowISO() };
    this.save(key, items);
    return items[index];
  },

  deleteItem(key, id) {
    const items = this.getAll(key);
    const filtered = items.filter(item => item.id !== id);
    this.save(key, filtered);
    return filtered;
  },

  getById(key, id) {
    const items = this.getAll(key);
    return items.find(item => item.id === id) || null;
  },

  getByField(key, field, value) {
    const items = this.getAll(key);
    return items.filter(item => item[field] === value);
  },

  // エクスポート/インポート
  exportAll() {
    const data = {};
    Object.values(this.KEYS).forEach(key => {
      data[key] = this.getAll(key);
    });
    return data;
  },

  importAll(data) {
    Object.values(this.KEYS).forEach(key => {
      if (Array.isArray(data[key])) {
        this.save(key, data[key]);
      }
    });
  },
};

// UUID生成
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 日付フォーマット
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowISO() {
  return new Date().toISOString();
}
