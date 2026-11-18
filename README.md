# 貸会場 空き状況照会 デモ Ver.0.1.0

架空データによる静的な照会画面です。会場別の月間一覧と日付別の全会場一覧を表示します。予約は受け付けず、紙による申込みを継続します。団体名・個人情報は掲載しません。

## ローカルで確認

このフォルダーで Python 3 の `python -m http.server 8000` を実行し、ブラウザーで http://localhost:8000/ を開きます。終了は Ctrl+C。JSON を取得するため、HTML ファイルを直接開く方法では動作しない場合があります。架空データの掲載期間は2026年11〜12月です。期間外に開いた場合は掲載開始日を表示します。

## データ形式

`updatedAt` はタイムゾーン付き日時、`period.start` / `period.end` は掲載期間（両端を含む）、`venues` は一意の `id` と `name`、`records` は `date`、`venueId`、`slots` を持ちます。`slots` の `morning`、`afternoon`、`evening` は `available`（空き）、`booked`（予約済）、`check`（要確認）、`closed`（休館／対象外）のいずれかです。欠けた日付・会場の組み合わせは「不明」と表示し、空きとは扱いません。取得失敗・不正データ時は一覧を表示しません。更新日時は日本時間で表示します。

将来、実際の Excel 台帳を確認して公開用 JSON の生成方法を設計します。生成処理は今回未実装です。公開前には、配布ファイル全体に団体名や個人情報が含まれていないことを確認してください。

## GitHub で管理する

新しい空のリポジトリを GitHub 上で作成し、その URL を指定して、このフォルダーで次を実行します。公開・非公開の設定は利用者が選択してください。

```sh
git init
git add index.html style.css script.js availability.json README.md CHANGELOG.md
git commit -m "Add availability demo v0.1.0"
git branch -M main
git remote add origin <リポジトリのURL>
git push -u origin main
```

以降は変更を確認し、git add、git commit、git push で履歴を残します。Git の初期設定や認証が必要な場合があります。リポジトリを非公開にしても、Web サーバーに配置したファイルは公開されます。

## WordPress 固定ページへの設置例

公開先が決まってから HTML、CSS、JavaScript、JSON の4ファイルを同じ公開フォルダーに配置します。固定ページのカスタム HTML ブロックに例を入れ、パスと高さを実際の環境に合わせて調整します。

```html
<iframe src="/availability/index.html" title="貸会場の空き状況" width="100%" height="850" style="border:0" loading="lazy"></iframe>
```

固定の高さでは画面内にスクロールが発生します。スマートフォンとパソコンで操作できる高さを確認してください。WordPress の権限・設定によって iframe が除去される場合や、サーバーの設定によって埋め込みが拒否される場合があります。HTTPS、JSON の配信、更新時のキャッシュ、実際のページでの表示を公開前に確認してください。デモをそのまま本番データとして公開しないでください。
