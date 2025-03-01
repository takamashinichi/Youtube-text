'use client';

import { useState, useEffect } from 'react';
import { AI_MODELS } from './utils/ai-models';

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
   - "〜してみましょう"など、親しみやすい表現

4. ハッシュタグ
   - 動画のテーマに関連する3-4個のタグ
   - トレンドタグと固有タグを組み合わせる
   - 日本語タグを優先（英語は補助的に）

# 文章スタイル
- 簡潔で読みやすい文体
- 一文は40文字以内を目安に
- 専門用語は平易な言葉に言い換え
- 感情を喚起する表現を適度に使用
- "です・ます"調で親しみやすく

# 出力フォーマット
（本文）

---
（ハッシュタグ）`;

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

// AIペルソナの型定義
interface AIPersona {
  character: string;
  tone: string;
  expertise: string;
  style: string;
  additionalInstructions: string;
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
  const [selectedModel, setSelectedModel] = useState<typeof AI_MODELS[number]['id']>('claude-3-opus');
  const [activeTab, setActiveTab] = useState<'x' | 'blog'>('x');
  const [targetPersona, setTargetPersona] = useState<TargetPersona>({
    ageRange: '25-34',
    gender: '指定なし',
    occupation: '',
    interests: [],
    painPoints: [],
  });
  const [aiPersona, setAIPersona] = useState<AIPersona>({
    character: 'プロフェッショナル',
    tone: 'フレンドリー',
    expertise: 'テクノロジー',
    style: '簡潔',
    additionalInstructions: '',
  });
  const [isPersonaVisible, setIsPersonaVisible] = useState(false);
  const [isAIPersonaVisible, setIsAIPersonaVisible] = useState(false);

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

  // AIペルソナの入力を処理する関数
  const handleAIPersonaChange = (field: keyof AIPersona, value: string) => {
    setAIPersona(prev => ({
      ...prev,
      [field]: value
    }));
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
      
      const apiUrl = `/api/transcript?videoId=${videoId}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '字幕の取得に失敗しました。');
      }

      // 字幕テキストを取得
      const text = await response.text();
      
      // 翻訳APIを呼び出す
      const translateResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text, 
          model: selectedModel 
        }),
      });

      if (!translateResponse.ok) {
        throw new Error('字幕の翻訳に失敗しました。');
      }

      const { translatedText } = await translateResponse.json();
      setTranscriptText(translatedText);

      // ターゲットペルソナとAIペルソナ情報をプロンプトに追加
      const enhancedPrompt = `
# AIペルソナ設定
- キャラクター: ${aiPersona.character}
- トーン: ${aiPersona.tone}
- 専門分野: ${aiPersona.expertise}
- 文体スタイル: ${aiPersona.style}
- 追加指示: ${aiPersona.additionalInstructions}

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
            text: translatedText, 
            prompt: enhancedPrompt, 
            model: selectedModel 
          }),
        });

        if (!summaryResponse.ok) {
          throw new Error(`要約の生成に失敗しました。ステータス: ${summaryResponse.status}`);
        }

        const { summary } = await summaryResponse.json();
        setSummary(summary);
      } else {
        const blogResponse = await fetch('/api/blog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: translatedText, prompt, model: selectedModel }),
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-fadeIn">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <span className="mr-2 text-red-600 dark:text-red-500">▶️</span>
                YouTube字幕取得・要約
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">YouTubeの動画内容をAIが要約し、X用の投稿文やブログ記事を生成します</p>
            </div>
            <div className="hidden sm:block">
              <a href="https://github.com/takamashinichi/Youtube-text" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        {/* タブ切り替え */}
        <div className="card mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">生成モードを選択</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setActiveTab('x');
                  setPrompt(DEFAULT_PROMPT);
                }}
                className={`p-6 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === 'x'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-200 dark:hover:border-blue-900'
                }`}
              >
                <div className="flex flex-col items-center space-y-3">
                  <span className="text-3xl">𝕏</span>
                  <span className="text-lg">X用投稿文を生成</span>
                  {activeTab === 'x' && (
                    <span className="text-sm bg-white/20 px-2 py-1 rounded-full">現在選択中</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('blog');
                  setPrompt('');
                }}
                className={`p-6 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === 'blog'
                    ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30 ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-gray-800'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-yellow-50 dark:hover:bg-gray-700 hover:border-yellow-200 dark:hover:border-yellow-900'
                }`}
              >
                <div className="flex flex-col items-center space-y-3">
                  <span className="text-3xl">📝</span>
                  <span className="text-lg">ブログ記事を生成</span>
                  {activeTab === 'blog' && (
                    <span className="text-sm bg-white/20 px-2 py-1 rounded-full">現在選択中</span>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* URL入力セクション */}
        <section className="card mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 mr-2">1</span>
              YouTube URLを入力
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.68 2.142a2.41 2.41 0 00-1.36 0 2.409 2.409 0 00-.787.363c-.248.184-.458.41-.607.655l-.124.217-.714-.428a2.41 2.41 0 00-1.18-.308c-.486 0-.95.14-1.353.424a2.416 2.416 0 00-.9 3.044l.124.217-.124.217a2.416 2.416 0 00.9 3.044 2.41 2.41 0 001.352.424c.415 0-.821-.105-1.18-.308l.714-.428.124.217c.15.245.36.471.607.655.228.169.48.295.788.363a2.41 2.41 0 001.36 0c.307-.068.56-.194.787-.363.248-.184.458-.41.607-.655l.124-.217.714.428a2.41 2.41 0 001.18.308 2.41 2.41 0 001.352-.424 2.416 2.416 0 00.9-3.044l-.124-.217.124-.217a2.416 2.416 0 00-.9-3.044 2.41 2.41 0 00-1.352-.424c-.415 0-.821.105-1.18.308L11.41 3.377l-.124-.217a2.417 2.417 0 00-.607-.655 2.409 2.409 0 00-.787-.363z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="pl-10 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">対応フォーマット：</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-7">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    通常の動画: youtube.com/watch?v=xxxx
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    短縮URL: youtu.be/xxxx
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    ショート: youtube.com/shorts/xxxx
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    埋め込み: youtube.com/embed/xxxx
                  </li>
                </ul>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">字幕取得：</span>
                  </div>
                  <p className="mt-1 ml-7">動画の元の言語の字幕を自動的に取得し、日本語に翻訳します。</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AIモデル選択セクション */}
        <section className="card mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 mr-2">2</span>
              AIモデルを選択
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AI_MODELS.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      selectedModel === model.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-400 shadow-md' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id={model.id}
                        name="model"
                        value={model.id}
                        checked={selectedModel === model.id}
                        onChange={() => setSelectedModel(model.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                      />
                      <label htmlFor={model.id} className="ml-2 block cursor-pointer">
                        <span className="font-medium text-gray-900 dark:text-white">{model.name}</span>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{model.description}</p>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* プロンプト設定セクション */}
        <section className="card mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 mr-2">3</span>
                プロンプト設定
              </h2>
              <div className="space-x-4">
                <button
                  onClick={() => setIsAIPersonaVisible(!isAIPersonaVisible)}
                  className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                >
                  {isAIPersonaVisible ? 'AIペルソナ設定を隠す ▼' : 'AIペルソナ設定を表示 ▶'}
                </button>
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

            {/* AIペルソナ設定 */}
            {isAIPersonaVisible && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-md font-medium text-gray-700 mb-4">AIペルソナ設定</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      キャラクター
                    </label>
                    <select
                      value={aiPersona.character}
                      onChange={(e) => handleAIPersonaChange('character', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="プロフェッショナル">プロフェッショナル</option>
                      <option value="フレンドリー">フレンドリー</option>
                      <option value="教師">教師</option>
                      <option value="コーチ">コーチ</option>
                      <option value="エンターテイナー">エンターテイナー</option>
                      <option value="アナリスト">アナリスト</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      トーン
                    </label>
                    <select
                      value={aiPersona.tone}
                      onChange={(e) => handleAIPersonaChange('tone', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="フレンドリー">フレンドリー</option>
                      <option value="カジュアル">カジュアル</option>
                      <option value="フォーマル">フォーマル</option>
                      <option value="熱意のある">熱意のある</option>
                      <option value="冷静">冷静</option>
                      <option value="ユーモラス">ユーモラス</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      専門分野
                    </label>
                    <select
                      value={aiPersona.expertise}
                      onChange={(e) => handleAIPersonaChange('expertise', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="テクノロジー">テクノロジー</option>
                      <option value="ビジネス">ビジネス</option>
                      <option value="教育">教育</option>
                      <option value="エンターテイメント">エンターテイメント</option>
                      <option value="健康・フィットネス">健康・フィットネス</option>
                      <option value="ライフスタイル">ライフスタイル</option>
                      <option value="科学">科学</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      文体スタイル
                    </label>
                    <select
                      value={aiPersona.style}
                      onChange={(e) => handleAIPersonaChange('style', e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="簡潔">簡潔</option>
                      <option value="詳細">詳細</option>
                      <option value="物語調">物語調</option>
                      <option value="説明的">説明的</option>
                      <option value="説得力のある">説得力のある</option>
                      <option value="インパクトのある">インパクトのある</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      追加指示
                    </label>
                    <textarea
                      value={aiPersona.additionalInstructions}
                      onChange={(e) => handleAIPersonaChange('additionalInstructions', e.target.value)}
                      placeholder="AIへの追加指示があれば入力してください"
                      className="w-full p-2 border rounded-lg h-20"
                    />
                  </div>
                </div>
              </div>
            )}

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
          </div>
        </section>

        {/* 送信ボタンセクション */}
        <section className="card mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 mr-2">4</span>
                要約を生成
              </h2>
              <span className="text-sm px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-sm">
                {activeTab === 'x' ? 'X用投稿文モード' : 'ブログ記事モード'}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !url.trim()}
              className={`w-full py-4 rounded-xl font-medium transition-all duration-300 ${
                isLoading || !url.trim()
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl shadow-blue-200 dark:shadow-blue-900/20 transform hover:-translate-y-0.5'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  生成中...
                </span>
              ) : (
                `字幕を取得して${activeTab === 'x' ? 'X用投稿文' : 'ブログ記事'}を生成`
              )}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-sm">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                  </svg>
                  {error}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 結果表示 - X用 */}
        {activeTab === 'x' && summary && (
          <section className="card mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
                <span className="text-blue-500 mr-2">𝕏</span>
                要約結果（X用投稿文）
              </h2>
              <div className="bg-gradient-to-tr from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-5 mb-4 border border-gray-200 dark:border-gray-700 shadow-inner">
                <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 leading-relaxed">{summary}</p>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{url}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    const text = `${summary}\n\n${url}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="flex-1 btn btn-primary flex items-center justify-center"
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                  </svg>
                  クリップボードにコピー
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(summary)}&url=${encodeURIComponent(url)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 btn bg-black text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center justify-center"
                >
                  <span className="mr-2">𝕏</span>
                  Xで投稿する
                </a>
              </div>
            </div>
          </section>
        )}

        {/* 結果表示 - ブログ用 */}
        {activeTab === 'blog' && blog && (
          <section className="card mb-8">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
                <span className="text-yellow-500 mr-2">📝</span>
                ブログ記事
              </h2>
              <div className="bg-gradient-to-tr from-gray-50 to-yellow-50 dark:from-gray-800 dark:to-yellow-900/20 rounded-xl p-5 mb-4 border border-gray-200 dark:border-gray-700 shadow-inner">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: blog }} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(blog.replace(/<[^>]*>/g, ''));
                  }}
                  className="flex-1 btn btn-primary flex items-center justify-center"
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                  </svg>
                  テキストをコピー
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(blog);
                  }}
                  className="flex-1 btn btn-secondary flex items-center justify-center"
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414L10 11.414l1.293 1.293a1 1 0 011.414-1.414L11.414 10l1.293-1.293a1 1 0 010-1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
                  </svg>
                  HTMLをコピー
                </button>
              </div>
            </div>
          </section>
        )}

        {transcriptText && (
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center">
              <span className="text-gray-500 mr-2">📄</span>
              元の字幕
            </h2>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="whitespace-pre-line text-gray-700 dark:text-gray-300 leading-relaxed">
                {transcriptText.split('\n').map((line, index) => (
                  <p key={index} className="mb-2">{line}</p>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
} 