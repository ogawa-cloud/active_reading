// stats.js — 統計・グラフ機能

const Stats = {
  monthlyChart: null,
  categoryChart: null,

  // 読了済みの本を取得
  getCompletedBooks() {
    return Book.getAll().filter(b => b.status === 'completed');
  },

  // 総読書冊数（読了のみ）
  getTotalCompleted() {
    return this.getCompletedBooks().length;
  },

  // 月別読書冊数（endDateベース）
  getMonthlyData(months) {
    const now = new Date();
    const labels = [];
    const data = [];
    const completed = this.getCompletedBooks();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = `${year}/${month + 1}月`;
      labels.push(label);

      const count = completed.filter(b => {
        if (!b.endDate) return false;
        const ed = new Date(b.endDate);
        return ed.getFullYear() === year && ed.getMonth() === month;
      }).length;
      data.push(count);
    }

    return { labels, data };
  },

  // カテゴリー別
  getCategoryData() {
    const completed = this.getCompletedBooks();
    const map = {};
    completed.forEach(b => {
      const cat = b.category || 'その他';
      map[cat] = (map[cat] || 0) + 1;
    });
    const labels = Object.keys(map);
    const data = Object.values(map);
    return { labels, data };
  },

  // 今月の読書数
  getCurrentMonthCount() {
    const now = new Date();
    return this.getCompletedBooks().filter(b => {
      if (!b.endDate) return false;
      const ed = new Date(b.endDate);
      return ed.getFullYear() === now.getFullYear() && ed.getMonth() === now.getMonth();
    }).length;
  },

  // グラフ描画
  renderMonthlyChart(months) {
    const ctx = document.getElementById('monthly-chart');
    if (!ctx) return;

    if (this.monthlyChart) {
      this.monthlyChart.destroy();
    }

    const { labels, data } = this.getMonthlyData(months);

    this.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '読書数',
          data,
          backgroundColor: '#4A90E2',
          borderRadius: 6,
          maxBarThickness: 40,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 },
          },
        },
      },
    });
  },

  renderCategoryChart() {
    const ctx = document.getElementById('category-chart');
    if (!ctx) return;

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    const { labels, data } = this.getCategoryData();

    if (labels.length === 0) {
      ctx.parentElement.innerHTML = '<p class="empty-message">データがありません</p>';
      return;
    }

    const colors = ['#4A90E2', '#7ED321', '#F5A623', '#E74C3C', '#9B59B6', '#1ABC9C', '#F39C12', '#3498DB', '#E67E22', '#2ECC71'];

    this.categoryChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, font: { size: 12 } },
          },
        },
      },
    });
  },

  renderProgressBar() {
    const rate = Actions.getCompletionRate();
    const fill = document.getElementById('action-progress-fill');
    const text = document.getElementById('action-progress-text');
    if (fill) fill.style.width = rate + '%';
    if (text) text.textContent = rate + '%';
  },

  // 統計画面全体の描画
  render(months) {
    months = months || 3;

    document.getElementById('stats-total-books').textContent = this.getTotalCompleted();
    this.renderMonthlyChart(months);
    this.renderCategoryChart();
    this.renderProgressBar();
  },
};
