import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 利用可能なAIモデル
const ALLOWED_MODELS = [
  'gpt-3.5-turbo', 
  'gpt-4', 
  'gpt-4-turbo',
  'gemini-pro',
  'claude-3-opus',
  'claude-3-sonnet'
];

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
    const systemPrompt = `${prompt || "あなたはYouTube動画のエンディング作成の専門家です。"}\n\n以下の制約を必ず守ってください：

# 実行指示
{台本}に基づいて、エンディングタイトルをナレーションテキストで出力してください。

# 必須要件
1. マズローの欲求段階
   - 1段目（生理的欲求）と2段目（安全欲求）を刺激
   - 生存本能に訴えかける表現
   - 安全・安心への欲求を喚起

2. CTR最適化要素
   - 次回予告の魅力的な提示
   - 具体的な日時や事実の言及
   - 緊急性や重要性の強調
   - 視聴者の感情に訴えかける表現

3. 視聴者エンゲージメント
   - チャンネル登録の促し
   - 高評価ボタンの案内
   - コメント欄での意見募集
   - 次回予告や伏線

# 文章構成
- 全体で300文字程度を厳守
- 印象的なまとめ
- 次回への期待感醸成
- 具体的なアクションの提示

# 補足
- 指示の再確認は不要
- 結論やまとめは不要
- 自己評価は不要
- チャンネル登録、高評価、コメントを必ず促す`;

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