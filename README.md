# YouTube Text

YouTubeの動画から字幕を取得するWebアプリケーション

## 機能

- YouTube URLから字幕を取得
- 対応フォーマット:
  - 通常の動画URL (youtube.com/watch?v=...)
  - 短縮URL (youtu.be/...)
  - 埋め込みURL (youtube.com/embed/...)
  - ショートURL (youtube.com/shorts/...)
- 字幕をテキストファイルとしてダウンロード

## 技術スタック

- Next.js
- TypeScript
- Tailwind CSS
- youtube-transcript (字幕取得ライブラリ)

## 開発環境のセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/takamashinichi/Youtube-text.git
cd Youtube-text

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

開発サーバーが起動したら、ブラウザで http://localhost:3000 にアクセスしてください。

## 使い方

1. YouTubeの動画URLをコピー
2. アプリケーションの入力フィールドにURLを貼り付け
3. 「字幕を取得」ボタンをクリック
4. 字幕テキストファイルが自動的にダウンロードされます

## ライセンス

MIT
