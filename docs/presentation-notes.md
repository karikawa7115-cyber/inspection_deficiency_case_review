# 明日の発表用メモ（5分）

## 提出物チェックリスト

- [ ] **アプリ URL**: https://inspection-deficiency-case-review.vercel.app/
- [ ] **図解 URL**: https://inspection-deficiency-case-review.vercel.app/presentation.html
- [ ] 画面キャプチャ（Case Review + Deficiency Database）を撮影済み
- [ ] 発表時に図解 URL をホームチャンネルに共有

---

## 発表台本（目安 5分）

### 0. 自己紹介・ツール概要（30秒）

「船舶の検査指摘事項をレビューする **Inspection Review Assistant** を作りました。
PSC や Class Survey で出た指摘を選び、レビューコメントや引継ぎメモなどのフォローアップ文書を作成する業務ツールです。」

→ 画面共有でアプリを開く（`/inspection`）

---

### 1. どんなデータを保持できるようにしたか（1分30秒）

「課題の『記憶』として実装したのは、**P4 のフォローアップ文書の編集内容**です。

具体的には：
- Review Comment（社内レビューコメント）
- Vessel Revision EN（船への英文修正指示）
- Handover Note（引継ぎメモ）
- など6種類のタブ

ここでテキストを編集したり、Supervisor 承認・DP 承認を押した状態が、**ブラウザをリロードしても消えません**。」

→ デモ：テキストを1行編集 → F5 でリロード → 残っていることを見せる

---

### 2. どこに保存したか、なぜそこを選んだか（1分30秒）

「保存先は3つに分けています。

| データ | 保存先 | 理由 |
|---|---|---|
| ユーザーの編集・承認 | **localStorage** | 今月は認証なしのプロトタイプ。ブラウザ内保存が最もシンプルで、リロード後も残る |
| 検査ケース・指摘マスター | **JSON ファイル** | Vercel の静的配信で DB なしでも動く。匿名化データを Git で管理 |
| 過去指摘の横断検索 | **Supabase** | 複数船のデータを SQL で検索したい。RLS で読み取り専用に制限 |

P1 の **Deficiency Database** を押すと Supabase のデータが表示されます。」

→ Deficiency Database 画面を少し見せる

---

### 3. 作ってみてどう感じたか（1分30秒）

「**工夫した点**は、業務ツールらしい4ペイン構成と、リスク・アラート・承認状態の色分けです。

**苦戦した点**は Vercel デプロイです。
`output: "export"` と Vercel の設定が噛み合わず、何度もビルドエラーになりました。
エラーログを AI に貼って一緒に読み解いたら、`out/` ディレクトリの問題だと分かり、解決できました。

**今後やりたいこと**は、localStorage の編集内容を Supabase に書き込んで、複数人で共同レビューできるようにすることです。」

---

## 想定される質問と回答

**Q: なぜ localStorage だけで十分なの？**
A: 今月のプロトタイプは「1人がブラウザで編集して、リロードしても消えない」ことがゴール。本番運用では Supabase + 認証が必要。

**Q: Supabase は書き込める？**
A: 今月は read-only（SELECT のみ）。RLS で INSERT/UPDATE/DELETE は禁止。

**Q: データは本物？**
A: すべて匿名化サンプル（DEMO VESSEL ALPHA 等）。実船名・実港名は含めていない。
