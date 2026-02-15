// markdown.js — Markdownエクスポート機能

const MarkdownExport = {
  // 1冊分のMarkdown生成
  generateForBook(bookId) {
    const book = Book.getById(bookId);
    if (!book) return '';

    const statusLabels = { before: '読む前', reading: '読書中', completed: '読了' };
    let md = '';

    // ヘッダー
    md += `# ${book.title}\n\n`;
    if (book.author) md += `**著者**: ${book.author}\n\n`;
    if (book.category) md += `**カテゴリー**: ${book.category}\n\n`;
    md += `**ステータス**: ${statusLabels[book.status] || book.status}\n\n`;
    md += `**開始日**: ${formatDate(book.startDate)}\n\n`;
    if (book.endDate) md += `**完了日**: ${formatDate(book.endDate)}\n\n`;

    // 読書時間
    const totalTime = Timer.getTotalTime(bookId);
    if (totalTime > 0) {
      md += `**読書時間**: ${Timer.formatTimeLabel(totalTime)}\n\n`;
    }

    md += `---\n\n`;

    // 読む前の問い
    const prq = Notes.getQuestions(bookId);
    if (prq && prq.questions.some(q => q.answer)) {
      md += `## 読む前の問い\n\n`;
      prq.questions.forEach((q, i) => {
        md += `### Q${i + 1}. ${q.question}\n\n`;
        md += q.answer ? `${q.answer}\n\n` : `*(未回答)*\n\n`;
      });
      md += `---\n\n`;
    }

    // 章メモ
    const chapters = Notes.getChapters(bookId);
    if (chapters.length > 0) {
      md += `## 章メモ\n\n`;
      chapters.forEach(ch => {
        md += `### 第${ch.chapterNumber}章${ch.chapterTitle ? ': ' + ch.chapterTitle : ''}\n\n`;
        if (ch.important) {
          md += `**重要なこと**\n\n${ch.important}\n\n`;
        }
        if (ch.memory) {
          md += `**記憶方法**\n\n${ch.memory}\n\n`;
        }
        if (ch.application) {
          md += `**応用方法**\n\n${ch.application}\n\n`;
        }
      });
      md += `---\n\n`;
    }

    // 実践項目
    const actions = Actions.getByBook(bookId);
    if (actions.length > 0) {
      md += `## 実践リスト\n\n`;
      actions.forEach(a => {
        const check = a.isDone ? 'x' : ' ';
        md += `- [${check}] ${a.content}`;
        if (a.doneDate) md += ` (完了: ${formatDate(a.doneDate)})`;
        md += `\n`;
        if (a.note) md += `  - メモ: ${a.note}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
    md += `*${formatDate(nowISO())} にエクスポート - アクティブリーディング*\n`;

    return md;
  },

  // 全冊分のMarkdown生成
  generateAll() {
    const books = Book.getAll();
    if (books.length === 0) return '# 読書記録\n\nまだ本が登録されていません。\n';

    let md = `# 読書記録\n\n`;
    md += `エクスポート日: ${formatDate(nowISO())}\n\n`;
    md += `総冊数: ${books.length}\n\n`;
    md += `---\n\n`;

    books.forEach(book => {
      md += this.generateForBook(book.id);
      md += `\n`;
    });

    return md;
  },

  // 1冊分をダウンロード
  downloadForBook(bookId) {
    const book = Book.getById(bookId);
    if (!book) return;
    const md = this.generateForBook(bookId);
    const filename = `${book.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    this.download(md, filename);
  },

  // 全冊分をダウンロード
  downloadAll() {
    const md = this.generateAll();
    this.download(md, `reading-notes-${todayISO()}.md`);
  },

  download(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
