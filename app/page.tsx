'use client';

import { useState } from 'react';

// YouTube URLから動画IDを抽出する関数
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/,
    /youtube\.com\/shorts\/([^&?/]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);

    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('有効なYouTube URLを入力してください。');
      }

      const response = await fetch(`/api/transcript?videoId=${videoId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '字幕の取得に失敗しました。');
      }

      // ファイルのダウンロードを開始
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `transcript_${videoId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">YouTube字幕取得</h1>
      <p className="mb-4">YouTubeの動画URLを入力して字幕を取得できます。</p>
      <div className="max-w-xl">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube URL（例：https://www.youtube.com/watch?v=xxxx）"
          className="w-full p-2 border rounded mb-2"
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed`}
        >
          {isLoading ? '取得中...' : '字幕を取得'}
        </button>
        {error && (
          <p className="mt-2 text-red-500">{error}</p>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <h2 className="font-bold mb-2">対応しているURL形式：</h2>
        <ul className="list-disc list-inside">
          <li>通常の動画: https://www.youtube.com/watch?v=xxxx</li>
          <li>短縮URL: https://youtu.be/xxxx</li>
          <li>埋め込み: https://www.youtube.com/embed/xxxx</li>
          <li>ショート: https://youtube.com/shorts/xxxx</li>
        </ul>
      </div>
    </main>
  )
} 