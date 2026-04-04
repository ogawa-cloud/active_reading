// app.js — メインアプリケーションロジック

const App = {
  history: [],
  currentScreen: 'home',
  currentBookId: null,

  init() {
    Storage.init();
    this.loadTheme();
    Timer.restore();
    this.setupEventListeners();
    this.navigate('home');
    this.updateHeaderDate();
    Sync.init();
  },

  // 画面遷移
  navigate(screen, param) {
    // 現在の画面を履歴に保存
    if (this.currentScreen && screen !== this.currentScreen) {
      this.history.push({ screen: this.currentScreen, param: this.currentBookId });
    }

    this.currentScreen = screen;
    this.currentBookId = param || null;

    // 全画面非表示
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // 対象画面表示
    const screenEl = document.getElementById(`${screen}-screen`);
    if (screenEl) {
      screenEl.classList.add('active');
    }

    // ナビボタンのアクティブ状態
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    // 画面別の初期化
    switch (screen) {
      case 'home':
        this.renderHome();
        break;
      case 'book-list':
        Book.renderList();
        break;
      case 'book-detail':
        if (param) Book.renderDetail(param);
        // デフォルトで最初のタブをアクティブに
        this.activateTab('questions');
        break;
      case 'stats':
        Stats.render(3);
        break;
    }

    // スクロールトップへ
    window.scrollTo(0, 0);
  },

  back() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.currentScreen = null; // 履歴に追加しないよう
      this.navigate(prev.screen, prev.param);
    } else {
      this.navigate('home');
    }
  },

  renderHome() {
    this.updateHeaderDate();

    // 読書中の本（最大3冊）
    const readingBooks = Book.getByStatus('reading').slice(0, 3);
    const readingContainer = document.getElementById('home-reading-books');
    const noReading = document.getElementById('home-no-reading');

    if (readingBooks.length === 0) {
      readingContainer.innerHTML = '';
      noReading.style.display = 'block';
    } else {
      noReading.style.display = 'none';
      readingContainer.innerHTML = readingBooks.map(b => Book.renderCard(b)).join('');
    }

    // 今日の実践
    Actions.renderHomeActions();

    // 統計サマリー
    document.getElementById('home-month-count').textContent = Stats.getCurrentMonthCount();
    document.getElementById('home-action-rate').textContent = Actions.getCompletionRate() + '%';
  },

  updateHeaderDate() {
    const d = new Date();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
    const el = document.getElementById('header-date');
    if (el) el.textContent = dateStr;
  },

  // タブ切替
  activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  },

  // 確認ダイアログ
  confirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <p>${Book.escapeHtml(message)}</p>
        <div class="form-actions">
          <button class="btn btn-secondary" id="confirm-cancel">キャンセル</button>
          <button class="btn btn-danger" id="confirm-ok">削除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#confirm-ok').onclick = () => {
      overlay.remove();
      onConfirm();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },

  // イベントリスナー設定
  setupEventListeners() {
    // 本のフォーム送信
    document.getElementById('book-form').addEventListener('submit', Book.handleFormSubmit);

    // 章メモフォーム送信
    document.getElementById('chapter-form').addEventListener('submit', Notes.handleChapterFormSubmit);

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activateTab(btn.dataset.tab);
      });
    });

    // フィルターボタン
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Book.renderList();
      });
    });

    // カテゴリーフィルター
    document.getElementById('category-filter').addEventListener('change', () => {
      Book.renderList();
    });

    // 検索
    document.getElementById('book-search').addEventListener('input', () => {
      Book.renderList();
    });

    // 統計期間選択
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Stats.render(parseInt(btn.dataset.period));
      });
    });
  },

  // ダークモード
  toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-toggle').textContent = isDark ? '🌙' : '☀️';
  },

  loadTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('theme-toggle').textContent = '☀️';
    }
  },

  // データエクスポート
  exportData() {
    const data = Storage.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `active-reading-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // データインポート
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          this.confirm('現在のデータを上書きしますか？', () => {
            Storage.importAll(data);
            this.navigate('home');
          });
        } catch {
          alert('無効なファイルです。');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
};

// Service Worker登録
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
