// sync.js — GitHub Gist を使ったクロスデバイス同期

const Sync = {
  // LocalStorage キー
  STORAGE_KEY_PAT:     'syncGitHubPAT',
  STORAGE_KEY_GIST_ID: 'syncGistId',
  STORAGE_KEY_LAST:    'syncLastAt',

  GIST_FILENAME: 'active-reading-data.json',
  API_BASE: 'https://api.github.com',

  isSyncing: false,

  // === 設定の読み書き ===
  getPAT()      { return localStorage.getItem(this.STORAGE_KEY_PAT) || ''; },
  getGistId()   { return localStorage.getItem(this.STORAGE_KEY_GIST_ID) || ''; },
  getLastSync() { return localStorage.getItem(this.STORAGE_KEY_LAST) || ''; },
  isConfigured(){ return !!this.getPAT(); },

  // === 設定モーダル操作 ===
  openSettings() {
    const modal = document.getElementById('sync-settings-modal');
    const patInput = document.getElementById('sync-pat-input');
    const gistRow = document.getElementById('sync-gist-id-row');
    const lastRow = document.getElementById('sync-last-sync-row');
    const disconnectBtn = document.getElementById('sync-disconnect-btn');

    // 保存済み値を反映
    const pat = this.getPAT();
    patInput.value = pat ? '••••••••••••••••••••' : '';
    patInput.dataset.saved = pat ? '1' : '';

    const gistId = this.getGistId();
    if (gistId) {
      document.getElementById('sync-gist-id-display').textContent = gistId;
      gistRow.style.display = 'block';
      disconnectBtn.style.display = 'inline-block';
    } else {
      gistRow.style.display = 'none';
      disconnectBtn.style.display = 'none';
    }

    const last = this.getLastSync();
    if (last) {
      document.getElementById('sync-last-sync-time').textContent = this._formatRelativeTime(last);
      lastRow.style.display = 'block';
    } else {
      lastRow.style.display = 'none';
    }

    // マスク表示中にフォーカスしたらクリア
    patInput.onfocus = () => {
      if (patInput.dataset.saved) {
        patInput.value = '';
        patInput.dataset.saved = '';
      }
    };

    modal.style.display = 'flex';
  },

  closeSettings() {
    document.getElementById('sync-settings-modal').style.display = 'none';
  },

  async saveSettings() {
    const patInput = document.getElementById('sync-pat-input');
    const saveBtn = document.getElementById('sync-save-btn');

    // 未変更（マスク表示のまま）の場合はPATを保持して同期だけ実行
    let pat;
    if (patInput.dataset.saved) {
      pat = this.getPAT();
    } else {
      pat = patInput.value.trim();
      if (!pat) {
        this.showToast('トークンを入力してください', 'error');
        return;
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '確認中...';

    const valid = await this.validatePAT(pat);
    if (!valid) {
      this.showToast('トークンが無効です。権限（gist）を確認してください。', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '保存して同期';
      return;
    }

    localStorage.setItem(this.STORAGE_KEY_PAT, pat);
    this.closeSettings();

    // 同期ボタンを表示して同期開始
    document.getElementById('sync-btn').style.display = 'inline-flex';
    saveBtn.disabled = false;
    saveBtn.textContent = '保存して同期';

    await this.syncNow();
  },

  disconnect() {
    App.confirm('クラウド同期を解除しますか？\nローカルのデータは削除されません。', () => {
      localStorage.removeItem(this.STORAGE_KEY_PAT);
      localStorage.removeItem(this.STORAGE_KEY_GIST_ID);
      localStorage.removeItem(this.STORAGE_KEY_LAST);
      document.getElementById('sync-btn').style.display = 'none';
      this.closeSettings();
      this.showToast('同期を解除しました');
    });
  },

  // === GitHub Gist API ===
  _headers(pat) {
    return {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  },

  async validatePAT(pat) {
    try {
      const res = await fetch(`${this.API_BASE}/user`, {
        headers: this._headers(pat),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async createGist(data) {
    const pat = this.getPAT();
    const res = await fetch(`${this.API_BASE}/gists`, {
      method: 'POST',
      headers: this._headers(pat),
      body: JSON.stringify({
        description: 'Active Reading App Data',
        public: false,
        files: {
          [this.GIST_FILENAME]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });
    if (!res.ok) {
      const err = new Error('Gist の作成に失敗しました');
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    return json.id;
  },

  async fetchGist(gistId) {
    const pat = this.getPAT();
    const res = await fetch(`${this.API_BASE}/gists/${gistId}`, {
      headers: this._headers(pat),
    });
    if (!res.ok) {
      const err = new Error('Gist の取得に失敗しました');
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    const raw = json.files?.[this.GIST_FILENAME]?.content;
    if (!raw) throw new Error('Gist にデータファイルが見つかりません');
    return JSON.parse(raw);
  },

  async updateGist(gistId, data) {
    const pat = this.getPAT();
    const res = await fetch(`${this.API_BASE}/gists/${gistId}`, {
      method: 'PATCH',
      headers: this._headers(pat),
      body: JSON.stringify({
        files: {
          [this.GIST_FILENAME]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });
    if (!res.ok) {
      const err = new Error('Gist の更新に失敗しました');
      err.status = res.status;
      throw err;
    }
  },

  // 同一アカウントの既存 active-reading Gist を検索（2台目デバイスのセットアップ用）
  async findExistingGist() {
    const pat = this.getPAT();
    const res = await fetch(`${this.API_BASE}/gists?per_page=100`, {
      headers: this._headers(pat),
    });
    if (!res.ok) return null;
    const gists = await res.json();
    const found = gists.find(g => g.files?.[this.GIST_FILENAME]);
    return found ? found.id : null;
  },

  // === マージロジック（Last-Write-Wins） ===
  mergeData(local, remote) {
    const merged = {};
    const keys = Object.values(Storage.KEYS);
    keys.forEach(key => {
      const localArr  = Array.isArray(local[key])  ? local[key]  : [];
      const remoteArr = Array.isArray(remote[key]) ? remote[key] : [];
      merged[key] = this.mergeArray(localArr, remoteArr);
    });
    return merged;
  },

  mergeArray(localArr, remoteArr) {
    const map = new Map();
    [...localArr, ...remoteArr].forEach(item => {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const existingTs = existing.updatedAt || existing.createdAt || '';
        const newTs      = item.updatedAt    || item.createdAt    || '';
        if (new Date(newTs) > new Date(existingTs)) {
          map.set(item.id, item);
        }
      }
    });
    return [...map.values()];
  },

  // === メイン同期処理 ===
  async syncNow() {
    if (!this.isConfigured()) {
      this.openSettings();
      return;
    }
    if (this.isSyncing) return;
    if (!navigator.onLine) {
      this.showToast('オフラインのため同期できません', 'warn');
      return;
    }

    this.isSyncing = true;
    this.setSyncStatus('syncing');

    try {
      const local = Storage.exportAll();
      let merged;
      let gistId = this.getGistId();

      if (!gistId) {
        // 2台目のデバイスの可能性があるため既存 Gist を検索
        gistId = await this.findExistingGist();
        if (gistId) {
          localStorage.setItem(this.STORAGE_KEY_GIST_ID, gistId);
        }
      }

      if (!gistId) {
        // 初回: ローカルデータをそのままアップロード
        gistId = await this.createGist(local);
        localStorage.setItem(this.STORAGE_KEY_GIST_ID, gistId);
        merged = local;
      } else {
        // 既存 Gist: リモートを取得してマージ
        const remote = await this.fetchGist(gistId);
        merged = this.mergeData(local, remote);
        await this.updateGist(gistId, merged);
      }

      Storage.importAll(merged);
      localStorage.setItem(this.STORAGE_KEY_LAST, new Date().toISOString());

      this.setSyncStatus('success');
      this.showToast('同期が完了しました ✓');

      // 現在の画面を再描画
      App.navigate(App.currentScreen, App.currentBookId);

      // 設定モーダル内の最終同期時刻を更新
      const lastRow = document.getElementById('sync-last-sync-row');
      if (lastRow && lastRow.style.display !== 'none') {
        document.getElementById('sync-last-sync-time').textContent =
          this._formatRelativeTime(this.getLastSync());
      }

      // 成功アイコンを3秒後に idle に戻す
      setTimeout(() => this.setSyncStatus('idle'), 3000);

    } catch (err) {
      // 404の場合: GistIdをクリアして次回再作成を試みる
      if (err.status === 404) {
        localStorage.removeItem(this.STORAGE_KEY_GIST_ID);
      }
      this.setSyncStatus('error');
      this.showToast(this._friendlyError(err), 'error');
      console.error('[Sync]', err);
      setTimeout(() => this.setSyncStatus('idle'), 4000);
    } finally {
      this.isSyncing = false;
    }
  },

  // === UI ヘルパー ===
  setSyncStatus(status) {
    const btn = document.getElementById('sync-btn');
    const icon = document.getElementById('sync-icon');
    if (!btn || !icon) return;

    btn.classList.remove('sync-idle', 'sync-syncing', 'sync-success', 'sync-error');
    btn.classList.add(`sync-${status}`);

    switch (status) {
      case 'syncing': icon.textContent = '🔄'; break;
      case 'success': icon.textContent = '✅'; break;
      case 'error':   icon.textContent = '⚠️'; break;
      default:        icon.textContent = '☁️'; break;
    }
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('sync-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `sync-toast sync-toast-${type} sync-toast-show`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('sync-toast-show');
    }, 3000);
  },

  _friendlyError(err) {
    const s = err.status;
    if (s === 401) return 'トークンが無効です。設定を確認してください。';
    if (s === 403) return 'APIレートリミットに達しました。しばらく待ってください。';
    if (s === 404) return 'Gistが見つかりません。再同期します。';
    if (!navigator.onLine) return 'オフラインのため同期できません。';
    return `同期に失敗しました（${err.message || s || '不明なエラー'}）`;
  },

  _formatRelativeTime(isoStr) {
    if (!isoStr) return '不明';
    const diff = Date.now() - new Date(isoStr).getTime();
    const min  = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day  = Math.floor(diff / 86400000);
    if (min  <  1) return 'たった今';
    if (min  < 60) return `${min}分前`;
    if (hour < 24) return `${hour}時間前`;
    return `${day}日前`;
  },

  // === アプリ起動時の初期化 ===
  init() {
    if (!this.isConfigured()) return;

    document.getElementById('sync-btn').style.display = 'inline-flex';

    // 最終同期から30分以上経過 かつ オンラインなら自動同期
    const last    = this.getLastSync();
    const elapsed = last ? (Date.now() - new Date(last).getTime()) : Infinity;
    if (navigator.onLine && elapsed > 30 * 60 * 1000) {
      this.syncNow();
    }
  },
};
