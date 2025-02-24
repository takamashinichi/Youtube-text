import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 利用可能なAIモデル
const ALLOWED_MODELS = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];

export async function POST(req: NextRequest) {
  try {
    const { text, prompt, model = 'gpt-4' } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "テキストが指定されていません。" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    // 動画台本生成用のプロンプト
    const systemPrompt = `あなたはYouTube動画の台本作成の専門家です。以下の制約を必ず守って、動画台本を生成してください。

# 視聴者プロファイル
- 年齢層: 35～54歳がメイン（特に45～54歳が最多）
- 職業: 会社員（管理職・専門職）、自営業、フリーランス
- 特徴: 未来予測、歴史、スピリチュアルに関心が高い

# 本質的欲求への対応
1. 好奇心と探求心
   - 未来予測と論理的分析への強い関心
   - 証拠に基づく考察の重視
   - 歴史的・スピリチュアルな要素の組み込み

2. 社会的つながり
   - 家族や友人との会話のネタとして活用可能な内容
   - 視聴者参加型の要素（意見募集など）

3. 不安解消
   - 未来の不確実性への対処法の提示
   - 具体的な対策や準備の方法の説明

4. エンターテインメント性
   - じっくり視聴できる論理的な展開
   - 6-15分程度の適切な長さ設計

# 台本構成
1. オープニング（30秒）
   - インパクトのある導入
   - 視聴価値の明確な提示
   - 目次の提示

2. 本編（5-7分）
   - 予言者・情報源の詳細な紹介
   - 予言内容の具体的な解説
   - 科学的・論理的な分析
   - 視聴者への実践的アドバイス

3. エンディング（30秒）
   - 重要ポイントの復習
   - 次回予告
   - 視聴者アクション（チャンネル登録等）の促し

# 演出指示
- カメラワーク（アップ、ズーム等）
- テロップ（重要キーワード、数値）
- 画面効果（図解、アニメーション）
- BGM（シーン別の雰囲気）
- B-roll（補足映像）

# 出力フォーマット
---
# タイトル
（視聴者の興味を引くタイトル）

## 動画の概要
（目的と価値提案）

## 目標再生時間
（合計時間：6-8分）

## オープニング（30秒）
（挨拶）
（導入と価値提案）
（目次）

## 本編
### セクション1: 予言者・情報源の紹介（1-2分）
（プロフィール詳細）
（実績や信頼性）
（演出指示）

### セクション2: 予言の詳細解説（2-3分）
（具体的な予言内容）
（科学的・論理的分析）
（演出指示）

### セクション3: 視聴者への提言（2-3分）
（具体的な対策）
（実践的アドバイス）
（演出指示）

## エンディング（30秒）
（まとめ）
（次回予告）
（チャンネル登録等の促し）

## 補足情報
・推奨BGM
・必要な撮影機材
・編集上の注意点
・サムネイル案`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `以下の動画内容を参考に、同じテーマで新しい動画の台本を生成してください。オリジナリティを出しつつ、視聴者により分かりやすい内容を心がけてください：\n\n${text}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const scriptContent = completion.choices[0].message.content?.trim() || '';
    
    if (!scriptContent) {
      throw new Error("台本の生成に失敗しました。");
    }

    return NextResponse.json({ 
      script: scriptContent
    });

  } catch (error) {
    console.error("台本生成エラー:", error);
    return NextResponse.json(
      { error: "台本の生成に失敗しました。" },
      { status: 500 }
    );
  }
} 