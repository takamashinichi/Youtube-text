'use client';

import { useState, useEffect } from 'react';

// デフォルトプロンプト
const DEFAULT_PROMPT = `あなたはYouTube動画の内容を魅力的なX投稿に変換する専門家です。
以下の制約を必ず守って投稿文を生成してください：

# 文字数制限
- 本文とハッシュタグを合わせて最大280文字以内
- URLは別途追加されるため、文字数にカウントしない

# 必須要素
1. コアメッセージ
   - 動画の最も重要なポイントを1-2文で簡潔に
   - インパクトのある表現を使用
   - 具体的な数字や事実を含める

2. 価値提案
   - 視聴者が得られる具体的なメリット
   - 実用的な知識やヒント
   - 新しい発見や気づき

3. アクションアイテム
   - 視聴者が次にとるべき行動を1つ提案
   - 具体的で実行可能な内容
   - 「〜してみましょう」など、親しみやすい表現

4. ハッシュタグ
   - 動画のテーマに関連する3-4個のタグ
   - トレンドタグと固有タグを組み合わせる
   - 日本語タグを優先（英語は補助的に）

# 文章スタイル
- 簡潔で読みやすい文体
- 一文は40文字以内を目安に
- 専門用語は平易な言葉に言い換え
- 感情を喚起する表現を適度に使用
- 「です・ます」調で親しみやすく

# 出力フォーマット
（本文）

---
（ハッシュタグ）`;

// 利用可能なAIモデル
const AI_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '高速で経済的' },
  { id: 'gpt-4', name: 'GPT-4', description: '高精度で詳細な分析が可能' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '最新のGPT-4モデル' },
  { id: 'gemini-pro', name: 'Gemini Pro', description: 'Googleの最新AI、高速で正確' },
  { id: 'claude-3-opus', name: 'Claude-3 Opus', description: '最高精度のAI、複雑な分析が得意' },
  { id: 'claude-3-sonnet', name: 'Claude-3 Sonnet', description: '高速で経済的なClaude' },
] as const;

// プロンプトの型定義
interface SavedPrompt {
  id: string;
  name: string;
  content: string;
}

interface TargetPersona {
  ageRange: string;
  gender: string;
  occupation: string;
  interests: string[];
  painPoints: string[];
}

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
  const [transcriptText, setTranscriptText] = useState('');
  const [summary, setSummary] = useState('');
  const [blog, setBlog] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptName, setPromptName] = useState('');
  const [selectedModel, setSelectedModel] = useState<typeof AI_MODELS[number]['id']>('gpt-3.5-turbo');
  const [activeTab, setActiveTab] = useState<'x' | 'blog'>('x');
  const [targetPersona, setTargetPersona] = useState<TargetPersona>({
    ageRange: '25-34',
    gender: '指定なし',
    occupation: '',
    interests: [],
    painPoints: [],
  });
  const [isPersonaVisible, setIsPersonaVisible] = useState(false);

  // 保存されたプロンプトを読み込む
  useEffect(() => {
    const saved = localStorage.getItem('savedPrompts');
    if (saved) {
      setSavedPrompts(JSON.parse(saved));
    }
  }, []);

  // プロンプトを保存
  const handleSavePrompt = () => {
    if (!promptName.trim() || !prompt.trim()) {
      setError('プロンプト名と内容を入力してください。');
      return;
    }

    const newPrompt: SavedPrompt = {
      id: Date.now().toString(),
      name: promptName.trim(),
      content: prompt.trim(),
    };

    const updatedPrompts = [...savedPrompts, newPrompt];
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
    setPromptName('');
    setError('');
  };

  // プロンプトを削除
  const handleDeletePrompt = (id: string) => {
    const updatedPrompts = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(updatedPrompts);
    localStorage.setItem('savedPrompts', JSON.stringify(updatedPrompts));
  };

  // プロンプトを選択
  const handleSelectPrompt = (content: string) => {
    setPrompt(content);
  };

  const handleSubmit = async () => {
    // すべての状態を初期化
    const resetState = () => {
      setError('');
      setIsLoading(true);
      setTranscriptText('');
      setSummary('');
      setBlog('');
    };

    try {
      resetState();
      
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('有効なYouTube URLを入力してください。');
      }

      const response = await fetch(`/api/transcript?videoId=${videoId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '字幕の取得に失敗しました。');
      }

      const text = await response.text();
      setTranscriptText(text);

      // ターゲットペルソナ情報をプロンプトに追加
      const personaPrompt = `
# ターゲット設定
- 年齢層: ${targetPersona.ageRange}
- 性別: ${targetPersona.gender}
- 職業: ${targetPersona.occupation}
- 興味・関心: ${targetPersona.interests.join('、')}
- 課題・悩み: ${targetPersona.painPoints.join('、')}

${prompt}`;

      // タブに応じて適切なAPIを呼び出す
      if (activeTab === 'x') {
        const summaryResponse = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text, 
            prompt: personaPrompt, 
            model: selectedModel 
          }),
        });

        if (!summaryResponse.ok) {
          throw new Error('要約の生成に失敗しました。');
        }

        const { summary } = await summaryResponse.json();
        setSummary(summary);
      } else {
        const blogResponse = await fetch('/api/blog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, prompt, model: selectedModel }),
        });

        if (!blogResponse.ok) {
          throw new Error('ブログ記事の生成に失敗しました。');
        }

        const { blog } = await blogResponse.json();
        setBlog(blog);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // ターゲットペルソナの入力を処理する関数
  const handlePersonaChange = (field: keyof TargetPersona, value: string | string[]) => {
    setTargetPersona(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 興味・関心とペインポイントの追加処理
  const handleArrayInput = (field: 'interests' | 'painPoints', value: string) => {
    if (value.trim()) {
      setTargetPersona(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
    }
  };

  // 興味・関心とペインポイントの削除処理
  const handleArrayRemove = (field: 'interests' | 'painPoints', index: number) => {
    setTargetPersona(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">YouTube字幕取得・要約</h1>
          <p className="mt-1 text-sm text-gray-600">YouTubeの動画内容をAIが要約し、X用の投稿文やブログ記事を生成します</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* タブ切り替え */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">生成モードを選択</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setActiveTab('x');
                setPrompt(DEFAULT_PROMPT);
              }}
              className={`p-4 rounded-lg font-medium transition-colors ${
                activeTab === 'x'
                  ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xl">𝕏</span>
                <span>X用投稿文を生成</span>
                {activeTab === 'x' && (
                  <span className="text-sm">現在選択中</span>
                )}
              </div>
            </button>
            <button
              onClick={() => {
                setActiveTab('blog');
                setPrompt('');
              }}
              className={`p-4 rounded-lg font-medium transition-colors ${
                activeTab === 'blog'
                  ? 'bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2'
                  : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <span className="text-xl">📝</span>
                <span>ブログ記事を生成</span>
                {activeTab === 'blog' && (
                  <span className="text-sm">現在選択中</span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* URL入力セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">1. 動画URLを入力</h2>
            <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {activeTab === 'x' ? 'X用投稿文モード' : 'ブログ記事モード'}
            </span>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL（例：https://www.youtube.com/watch?v=xxxx）"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-sm text-gray-500">
              <p className="font-medium mb-1">対応フォーマット：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>通常の動画: youtube.com/watch?v=xxxx</li>
                <li>短縮URL: youtu.be/xxxx</li>
                <li>ショート: youtube.com/shorts/xxxx</li>
              </ul>
            </div>
          </div>
        </section>

        {/* AIモデル選択セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. AIモデルを選択</h2>
          <div className="grid gap-3">
            {AI_MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <input
                  type="radio"
                  name="ai-model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value as typeof selectedModel)}
                  className="w-4 h-4 text-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">{model.name}</div>
                  <div className="text-sm text-gray-500">{model.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* プロンプト設定セクション */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">3. プロンプト設定</h2>
            <div className="space-x-4">
              <button
                onClick={() => setIsPersonaVisible(!isPersonaVisible)}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                {isPersonaVisible ? 'ターゲット設定を隠す ▼' : 'ターゲット設定を表示 ▶'}
              </button>
              <button
                onClick={() => setIsPromptVisible(!isPromptVisible)}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                {isPromptVisible ? 'プロンプト設定を隠す ▼' : 'プロンプト設定を表示 ▶'}
              </button>
            </div>
          </div>

          {/* ターゲットペルソナ設定 */}
          {isPersonaVisible && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-md font-medium text-gray-700 mb-4">ターゲット設定</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    年齢層
                  </label>
                  <select
                    value={targetPersona.ageRange}
                    onChange={(e) => handlePersonaChange('ageRange', e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="18-24">18-24歳</option>
                    <option value="25-34">25-34歳</option>
                    <option value="35-44">35-44歳</option>
                    <option value="45-54">45-54歳</option>
                    <option value="55-64">55-64歳</option>
                    <option value="65+">65歳以上</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    性別
                  </label>
                  <select
                    value={targetPersona.gender}
                    onChange={(e) => handlePersonaChange('gender', e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="指定なし">指定なし</option>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    職業
                  </label>
                  <input
                    type="text"
                    value={targetPersona.occupation}
                    onChange={(e) => handlePersonaChange('occupation', e.target.value)}
                    placeholder="例：会社員、学生、主婦など"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    興味・関心
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      placeholder="興味・関心を入力"
                      className="flex-1 p-2 border rounded-lg"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          handleArrayInput('interests', input.value);
                          input.value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {targetPersona.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center"
                      >
                        {interest}
                        <button
                          onClick={() => handleArrayRemove('interests', index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    課題・悩み
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      placeholder="課題・悩みを入力"
                      className="flex-1 p-2 border rounded-lg"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          handleArrayInput('painPoints', input.value);
                          input.value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {targetPersona.painPoints.map((point, index) => (
                      <span
                        key={index}
                        className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm flex items-center"
                      >
                        {point}
                        <button
                          onClick={() => handleArrayRemove('painPoints', index)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 既存のプロンプト設定部分 */}
          {isPromptVisible && (
            <div className="space-y-6">
              {/* 保存済みプロンプト */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">保存したプロンプト</h3>
                <div className="space-y-2">
                  {activeTab === 'x' && (
                    <button
                      onClick={() => handleSelectPrompt(DEFAULT_PROMPT)}
                      className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                    >
                      デフォルトに戻す
                    </button>
                  )}
                  {savedPrompts.map((savedPrompt) => (
                    <div
                      key={savedPrompt.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100"
                    >
                      <button
                        onClick={() => handleSelectPrompt(savedPrompt.content)}
                        className="text-left flex-1"
                      >
                        {savedPrompt.name}
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(savedPrompt.id)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 新規プロンプト保存 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {activeTab === 'x' ? 'X用投稿文のプロンプト' : 'ブログ記事のプロンプト'}
                </h3>
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="プロンプト名"
                  className="w-full p-3 border rounded-lg mb-3"
                />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`${
                    activeTab === 'x' ? 'X用投稿文の生成指示を入力' : 'ブログ記事の生成指示を入力'
                  }`}
                  className="w-full p-3 border rounded-lg h-32 mb-3"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    ※ プロンプトは{
                      activeTab === 'x' ? 'X用投稿文' : 'ブログ記事'
                    }の生成指示として使用されます
                  </p>
                  <button
                    onClick={handleSavePrompt}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 実行ボタン */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">4. 要約を生成</h2>
            <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              {activeTab === 'x' ? 'X用投稿文モード' : 'ブログ記事モード'}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !url.trim()}
            className={`w-full py-4 rounded-lg font-medium transition-colors ${
              isLoading || !url.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? '生成中...' : `字幕を取得して${activeTab === 'x' ? 'X用投稿文' : 'ブログ記事'}を生成`}
          </button>
          {error && (
            <p className="mt-3 text-red-500 text-sm">{error}</p>
          )}
        </section>

        {/* 結果表示 */}
        {activeTab === 'x' && summary && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">要約結果（X用）</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="whitespace-pre-wrap text-gray-900">{summary}</p>
              <p className="text-gray-500 mt-2 text-sm">{url}</p>
            </div>
            <button
              onClick={() => {
                const text = `${summary}\n\n${url}`;
                navigator.clipboard.writeText(text);
              }}
              className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              クリップボードにコピー
            </button>
          </section>
        )}

        {activeTab === 'blog' && blog && (
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">ブログ記事</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-900" dangerouslySetInnerHTML={{ __html: blog }} />
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(blog);
              }}
              className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              クリップボードにコピー
            </button>
          </section>
        )}

        {transcriptText && (
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">元の字幕</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="whitespace-pre-wrap text-sm text-gray-600">{transcriptText}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
} 