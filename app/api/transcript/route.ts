import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

// 利用可能なAIモデル
const ALLOWED_MODELS = [
  'gpt-3.5-turbo', 
  'gpt-4', 
  'gpt-4-turbo',
  'gemini-pro',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-opus',
  'claude-3-sonnet'
];

// テキストを日本語に翻訳する関数
async function translateToJapanese(text: string, model: string): Promise<string> {
  console.log(`Translating with model: ${model}`);
  let translatedText = '';

  try {
    if (model === 'gpt-3.5-turbo' || model === 'gpt-4') {
      console.log('Sending translation request to OpenAI');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: '以下のテキストを日本語に翻訳してください。翻訳は自然で流暢な日本語にし、原文の意味を正確に伝えてください。必ず日本語のみで出力してください。',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      });

      translatedText = response.choices[0].message.content || '';
      if (!translatedText) {
        throw new Error('OpenAI translation failed: Empty response');
      }
    } else if (model === 'gemini-pro') {
      console.log('Sending translation request to Gemini');
      
      try {
        const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

        // Gemini APIの設定を改善
        const genModel = googleAI.getGenerativeModel({ 
          model: 'gemini-pro',
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
          }
        });

        // 翻訳用のプロンプトを構築
        const prompt = `以下のテキストを日本語に翻訳してください。翻訳は自然で流暢な日本語にし、原文の意味を正確に伝えてください。必ず日本語のみで出力してください。

原文:
${text}

日本語訳:`;

        console.log('Gemini prompt constructed, sending request...');
        
        const result = await genModel.generateContent(prompt);
        console.log('Gemini response received');
        
        // レスポンスの検証
        if (!result || !result.response) {
          throw new Error('Gemini translation failed: Invalid or empty response');
        }
        
        // Gemini APIのレスポンス処理を修正
        let responseText = '';
        if (result.response.text) {
          // text()メソッドが存在する場合（関数として）
          if (typeof result.response.text === 'function') {
            responseText = result.response.text();
          } 
          // textがプロパティの場合
          else if (typeof result.response.text === 'string') {
            responseText = result.response.text;
          }
        } else if (result.response.candidates && result.response.candidates.length > 0) {
          // candidatesからテキストを取得する代替方法
          responseText = result.response.candidates[0].content?.parts?.[0]?.text || '';
        }
        
        if (!responseText) {
          throw new Error('Gemini translation failed: Could not extract text from response');
        }
        
        translatedText = responseText;
        console.log('Gemini translation successful');
      } catch (geminiError) {
        console.error('Gemini API error:', geminiError);
        console.log('Falling back to Claude API for translation');
        
        // Gemini APIが失敗した場合、Claude APIにフォールバック
        return translateToJapanese(text, 'claude-3-haiku-20240307');
      }
    } else if (model.startsWith('claude')) {
      console.log('Sending translation request to Claude');
      const anthropic = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 4000,
        system: '以下のテキストを日本語に翻訳してください。翻訳は自然で流暢な日本語にし、原文の意味を正確に伝えてください。必ず日本語のみで出力してください。',
        messages: [
          {
            role: 'user',
            content: `以下のテキストを日本語に翻訳してください：\n\n${text}`,
          },
        ],
        temperature: 0.3,
      });

      // Anthropic APIのレスポンス構造に対応
      if (response.content && response.content.length > 0) {
        const content = response.content[0];
        // contentオブジェクトの型に応じて適切にテキストを取得
        if ('text' in content) {
          translatedText = content.text;
        } else if (typeof content === 'object' && content !== null) {
          // ToolUseBlockなど他の型の場合、利用可能なプロパティから取得を試みる
          translatedText = JSON.stringify(content);
        }
      }
      
      if (!translatedText) {
        throw new Error('Claude translation failed: Empty response');
      }
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    
    // エラーが発生した場合、別のモデルにフォールバック
    if (model !== 'claude-3-haiku-20240307') {
      console.log('Falling back to Claude API for translation');
      return translateToJapanese(text, 'claude-3-haiku-20240307');
    }
    
    // エラーオブジェクトの型を適切に処理
    const errorMessage = error instanceof Error ? error.message : '不明なエラー';
    throw new Error(`Translation failed: ${errorMessage}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const translateToJp = searchParams.get("translate") === "true";
    const model = searchParams.get("model") || "claude-3-sonnet";

    if (!videoId) {
      return NextResponse.json(
        { error: "動画IDが指定されていません。" },
        { status: 400 }
      );
    }

    if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
      return NextResponse.json(
        { error: "無効な動画IDです。" },
        { status: 400 }
      );
    }

    if (translateToJp && !ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: "無効なAIモデルが指定されました。" },
        { status: 400 }
      );
    }

    // 字幕を取得
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(transcript);
    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "字幕が見つかりませんでした。" },
        { status: 404 }
      );
    }

    // 字幕のテキストのみを抽出
    const transcriptText = transcript
      .map(entry => entry.text.trim())
      .filter(text => text.length > 0)
      .join("\n");

    // 翻訳が要求された場合
    let finalText = transcriptText;
    if (translateToJp) {
      try {
        finalText = await translateToJapanese(transcriptText, model);
      } catch (error) {
        console.error("翻訳エラー:", error);
        return NextResponse.json(
          { error: "字幕の翻訳に失敗しました。" },
          { status: 500 }
        );
      }
    }

    const filename = encodeURIComponent(`transcript_${videoId}${translateToJp ? '_jp' : ''}.txt`);

    return new NextResponse(finalText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("字幕取得エラー:", error);
    
    // YoutubeTranscriptのエラーをより詳細に処理
    if (error instanceof Error) {
      if (error.message.includes("No transcript found")) {
        return NextResponse.json(
          { error: "この動画には字幕がありません。" },
          { status: 404 }
        );
      }
      if (error.message.includes("Video unavailable")) {
        return NextResponse.json(
          { error: "動画が見つかりません。" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "字幕の取得に失敗しました。" },
      { status: 500 }
    );
  }
} 