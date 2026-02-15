// book.js — 本管理機能

const Book = {
  currentBookId: null,

  // 本の登録
  add(title, author, category) {
    const book = {
      id: generateUUID(),
      title,
      author: author || '',
      category: category || '',
      status: 'before',
      startDate: todayISO(),
      endDate: null,
      createdAt: nowISO(),
    };
    Storage.addItem(Storage.KEYS.BOOKS, book);
    // 読む前の問いを自動生成
    Notes.createDefaultQuestions(book.id);
    return book;
  },

  update(id, updates) {
    if (updates.status === 'completed') {
      updates.endDate = todayISO();
    }
    return Storage.updateItem(Storage.KEYS.BOOKS, id, updates);
  },

  delete(id) {
    // 関連データも削除
    const questions = Storage.getByField(Storage.KEYS.PRE_READING_QUESTIONS, 'bookId', id);
    questions.forEach(q => Storage.deleteItem(Storage.KEYS.PRE_READING_QUESTIONS, q.id));

    const notes = Storage.getByField(Storage.KEYS.CHAPTER_NOTES, 'bookId', id);
    notes.forEach(n => Storage.deleteItem(Storage.KEYS.CHAPTER_NOTES, n.id));

    const actions = Storage.getByField(Storage.KEYS.ACTION_ITEMS, 'bookId', id);
    actions.forEach(a => Storage.deleteItem(Storage.KEYS.ACTION_ITEMS, a.id));

    Storage.deleteItem(Storage.KEYS.BOOKS, id);
  },

  getAll() {
    return Storage.getAll(Storage.KEYS.BOOKS);
  },

  getById(id) {
    return Storage.getById(Storage.KEYS.BOOKS, id);
  },

  getByStatus(status) {
    return Storage.getByField(Storage.KEYS.BOOKS, 'status', status);
  },

  getCategories() {
    const books = this.getAll();
    const cats = new Set(books.map(b => b.category).filter(Boolean));
    return [...cats].sort();
  },

  getChapterCount(bookId) {
    return Storage.getByField(Storage.KEYS.CHAPTER_NOTES, 'bookId', bookId).length;
  },

  getActionCount(bookId) {
    return Storage.getByField(Storage.KEYS.ACTION_ITEMS, 'bookId', bookId).length;
  },

  // --- UI ---

  showAddForm() {
    document.getElementById('book-form-title').textContent = '本を追加';
    document.getElementById('book-form-id').value = '';
    document.getElementById('book-form-bookTitle').value = '';
    document.getElementById('book-form-author').value = '';
    document.getElementById('book-form-category').value = '';
    App.navigate('book-form');
  },

  showEditForm(id) {
    const book = this.getById(id);
    if (!book) return;
    document.getElementById('book-form-title').textContent = '本を編集';
    document.getElementById('book-form-id').value = book.id;
    document.getElementById('book-form-bookTitle').value = book.title;
    document.getElementById('book-form-author').value = book.author;
    document.getElementById('book-form-category').value = book.category;
    App.navigate('book-form');
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('book-form-id').value;
    const title = document.getElementById('book-form-bookTitle').value.trim();
    const author = document.getElementById('book-form-author').value.trim();
    const category = document.getElementById('book-form-category').value;

    if (!title) return;

    if (id) {
      Book.update(id, { title, author, category });
      App.navigate('book-detail', id);
    } else {
      const book = Book.add(title, author, category);
      App.navigate('book-detail', book.id);
    }
  },

  handleDelete(id) {
    App.confirm('この本を削除しますか？関連するメモ・実践項目もすべて削除されます。', () => {
      Book.delete(id);
      App.navigate('book-list');
    });
  },

  // 本リスト画面の描画
  renderList() {
    const searchQuery = (document.getElementById('book-search').value || '').toLowerCase();
    const statusFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const categoryFilter = document.getElementById('category-filter').value;

    let books = this.getAll();

    if (statusFilter !== 'all') {
      books = books.filter(b => b.status === statusFilter);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      books = books.filter(b => b.category === categoryFilter);
    }
    if (searchQuery) {
      books = books.filter(b =>
        b.title.toLowerCase().includes(searchQuery) ||
        b.author.toLowerCase().includes(searchQuery)
      );
    }

    // 新しい順
    books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const container = document.getElementById('book-list');
    const empty = document.getElementById('book-list-empty');

    if (books.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = books.map(book => this.renderCard(book)).join('');

    // カテゴリーフィルター更新
    this.updateCategoryFilter();
  },

  renderCard(book) {
    const statusLabels = { before: '読む前', reading: '読書中', completed: '読了' };
    const chapterCount = this.getChapterCount(book.id);
    const actionCount = this.getActionCount(book.id);

    return `
      <div class="book-card" onclick="App.navigate('book-detail', '${book.id}')">
        <div class="book-card-title">${this.escapeHtml(book.title)}</div>
        ${book.author ? `<div class="book-card-author">${this.escapeHtml(book.author)}</div>` : ''}
        <div class="book-card-meta">
          <span class="badge badge-${book.status}">${statusLabels[book.status]}</span>
          ${chapterCount > 0 ? `<span class="meta-count">📝 ${chapterCount}章</span>` : ''}
          ${actionCount > 0 ? `<span class="meta-count">✅ ${actionCount}件</span>` : ''}
        </div>
      </div>
    `;
  },

  updateCategoryFilter() {
    const select = document.getElementById('category-filter');
    const current = select.value;
    const categories = this.getCategories();
    select.innerHTML = '<option value="all">全カテゴリー</option>' +
      categories.map(c => `<option value="${c}"${c === current ? ' selected' : ''}>${c}</option>`).join('');
  },

  // 本の詳細画面描画
  renderDetail(bookId) {
    this.currentBookId = bookId;
    const book = this.getById(bookId);
    if (!book) return;

    const statusLabels = { before: '読む前', reading: '読書中', completed: '読了' };

    // 基本情報
    document.getElementById('book-detail-info').innerHTML = `
      <h2>${this.escapeHtml(book.title)}</h2>
      ${book.author ? `<p class="author">${this.escapeHtml(book.author)}</p>` : ''}
      ${book.category ? `<p class="category">${book.category}</p>` : ''}
      <p class="dates">
        開始: ${formatDate(book.startDate)}
        ${book.endDate ? ` / 完了: ${formatDate(book.endDate)}` : ''}
      </p>
    `;

    // ステータス変更ボタン
    document.getElementById('status-changer').innerHTML = ['before', 'reading', 'completed'].map(s =>
      `<button class="status-btn${book.status === s ? ' active' : ''}" onclick="Book.changeStatus('${bookId}', '${s}')">${statusLabels[s]}</button>`
    ).join('');

    // ボタン
    document.getElementById('export-md-btn').onclick = () => MarkdownExport.downloadForBook(bookId);
    document.getElementById('edit-book-btn').onclick = () => Book.showEditForm(bookId);
    document.getElementById('delete-book-btn').onclick = () => Book.handleDelete(bookId);

    // タイマー
    Timer.renderForBook(bookId);

    // タブコンテンツ描画
    Notes.renderQuestions(bookId);
    Notes.renderChapters(bookId);
    Actions.renderList(bookId);
  },

  changeStatus(bookId, status) {
    this.update(bookId, { status });
    this.renderDetail(bookId);
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
