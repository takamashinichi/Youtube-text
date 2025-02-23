import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 利用可能なAIモデル
const ALLOWED_MODELS = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];

export async function POST(req: NextRequest) {
  try {
    const { text, prompt, model = 'gpt-3.5-turbo' } = await req.json();

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

    // プロンプトに文字数制限を明示的に追加
    const systemPrompt = `${prompt || "あなたはYouTube動画の字幕を要約する専門家です。"}\n\n以下の制約を必ず守ってください：
1. 要約は内容の専門性や複雑さに応じて適切な文字数を選択してください：
   - 一般的な内容：50〜100文字程度で簡潔に
   - 専門的な内容：140〜280文字程度で詳細に
   - 必要に応じて改行を入れて読みやすく
2. 文章は最後まで完結させてください
3. 要約は日本語で生成してください
4. 文末は「。」で終わり、句点の重複は避けてください
5. 動画の内容に最も関連する具体的なハッシュタグを2-3個提案してください
6. ハッシュタグは要約本文とは別に出力してください
7. ハッシュタグは日本語で、トピックを具体的に表すものを選んでください

出力フォーマット：
---
要約本文（句点は重複させない）
---
#具体的なハッシュタグ1 #具体的なハッシュタグ2 #具体的なハッシュタグ3`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content?.trim() || '';
    
    // 要約本文とハッシュタグを分離
    const [summaryText, hashtagText = ''] = response.split('---').map(text => text.trim());
    
    if (!summaryText) {
      throw new Error("要約の生成に失敗しました。");
    }

    // 句点の重複を防ぐ
    const cleanedSummaryText = summaryText.replace(/。+/g, '。');

    // 文字数制限のチェック（280文字を上限とする）
    const MAX_LENGTH = 280;
    const NEWLINE_LENGTH = 2; // \n\n の長さ

    // ハッシュタグを含めた全体の長さをチェック
    const totalLength = cleanedSummaryText.length + NEWLINE_LENGTH + hashtagText.length;

    if (totalLength > MAX_LENGTH) {
      // ハッシュタグ部分を確保した上で、要約本文を切り詰める
      const maxSummaryLength = MAX_LENGTH - NEWLINE_LENGTH - hashtagText.length - 3; // "..." の長さを考慮
      const truncatedSummary = cleanedSummaryText.slice(0, maxSummaryLength) + "...";
      return NextResponse.json({ 
        summary: `${truncatedSummary}\n\n${hashtagText}`
      });
    }

    // 文字数制限内の場合はそのまま返す
    return NextResponse.json({ 
      summary: `${cleanedSummaryText}\n\n${hashtagText}`
    });

  } catch (error) {
    console.error("要約エラー:", error);
    return NextResponse.json(
      { error: "テキストの要約に失敗しました。" },
      { status: 500 }
    );
  }
} 