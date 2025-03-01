import { NextRequest, NextResponse } from "next/server";
import * as xml2js from 'xml2js';

// 字幕を取得する関数
async function getTranscript(videoId: string, languageCode: string = ''): Promise<string> {
  try {
    console.log(`[${new Date().toISOString()}] 字幕取得開始 - VideoID: ${videoId}`);
    
    // youtubetranscript.comのAPIを使用
    const transcriptUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`;
    console.log(`[${new Date().toISOString()}] 字幕API呼び出し - URL: ${transcriptUrl}`);
    
    const response = await fetch(transcriptUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; TranscriptFetcher/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get transcript: ${response.status} ${response.statusText}`);
    }
    
    // レスポンスのContent-Typeをチェック
    const contentType = response.headers.get('Content-Type') || '';
    
    // XMLデータの場合
    if (contentType.includes('application/xml') || contentType.includes('text/xml') || 
        contentType.includes('text/plain') && await response.clone().text().then(text => text.includes('<transcript>'))) {
      console.log(`[${new Date().toISOString()}] XML形式の字幕データを受信`);
      const xmlData = await response.text();
      return await formatCaptionText(xmlData);
    } 
    // JSONデータの場合
    else {
      try {
        const data = await response.json();
        
        if (!data || !data.transcript) {
          throw new Error('No transcript found for this video');
        }
        
        // 言語コードが指定されている場合は、その言語の字幕をフィルタリング
        let transcriptText = data.transcript;
        if (languageCode && data.languages && data.languages.length > 0) {
          // 言語が一致する字幕があるか確認
          const matchingLanguage = data.languages.find(
            (lang: { code: string; name: string }) => lang.code === languageCode || lang.name.toLowerCase().includes(languageCode.toLowerCase())
          );
          
          if (matchingLanguage) {
            // 言語が一致する字幕を取得
            const langResponse = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}&lang=${matchingLanguage.code}`);
            if (langResponse.ok) {
              const langData = await langResponse.json();
              if (langData && langData.transcript) {
                transcriptText = langData.transcript;
              }
            }
          } else {
            console.warn(`[${new Date().toISOString()}] 警告 - 指定された言語(${languageCode})の字幕が見つかりません - デフォルトを使用`);
          }
        }
        
        return transcriptText;
      } catch (error) {
        // JSONパースに失敗した場合、テキストとして処理
        console.warn(`[${new Date().toISOString()}] JSON解析エラー、テキストとして処理します:`, error);
        const textData = await response.clone().text();
        return await formatCaptionText(textData);
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 字幕取得エラー:`, error);
    
    throw new Error(`Failed to get transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function GET(req: NextRequest) {
  try {
    // リクエスト情報をログに記録
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    console.log(`[${new Date().toISOString()}] 字幕API リクエスト受信 - IP: ${clientIp}`);
    
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');
    const languageCode = searchParams.get('languageCode') || '';
    
    console.log(`[${new Date().toISOString()}] 字幕リクエスト - VideoID: ${videoId}, 言語コード: ${languageCode || 'デフォルト'}`);

    if (!videoId) {
      console.warn(`[${new Date().toISOString()}] 字幕エラー - VideoIDが指定されていません`);
      return NextResponse.json(
        { error: "YouTube動画IDが指定されていません。" },
        { status: 400 }
      );
    }

    // 動画IDのバリデーションを強化
    if (!videoId.match(/^[a-zA-Z0-9_-]{11}$/)) {
      console.warn(`[${new Date().toISOString()}] 字幕エラー - 無効な動画ID: ${videoId}`);
      return NextResponse.json(
        { error: "無効な動画IDです。" },
        { status: 400 }
      );
    }

    let transcriptText = '';

    try {
      console.log(`[${new Date().toISOString()}] 字幕取得開始 - VideoID: ${videoId}`);
      
      // 新しいAPIを使用して字幕を取得
      transcriptText = await getTranscript(videoId, languageCode);
      
      // YoutubeTranscriptを使用するフォールバック部分を削除
      if (!transcriptText) {
        throw new Error('No transcript found for this video');
      }
      
      console.log(`[${new Date().toISOString()}] 字幕取得成功 - 文字数: ${transcriptText.length}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 字幕取得エラー:`, error);
      
      // エラーをより詳細に処理
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

    console.log(`[${new Date().toISOString()}] 字幕API 成功レスポンス - 文字数: ${transcriptText.length}`);

    // セキュリティヘッダーを追加
    return new NextResponse(transcriptText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] 字幕API エラー発生:`, error);
    let errorMessage = "字幕の取得に失敗しました。";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error(`[${new Date().toISOString()}] エラーメッセージ: ${errorMessage}`);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// 字幕テキストを整形する関数
async function formatCaptionText(captionData: string): Promise<string> {
  try {
    console.log(`[${new Date().toISOString()}] 字幕テキスト整形開始`);
    
    // XMLフォーマットの字幕データを処理
    if (captionData.includes('<transcript>')) {
      console.log(`[${new Date().toISOString()}] XMLパーサーを使用して字幕を処理します`);
      
      // xml2jsを使用してXMLを解析
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(captionData);
      
      if (result && result.transcript && result.transcript.text) {
        // 複数のテキスト要素がある場合（配列の場合）
        if (Array.isArray(result.transcript.text)) {
          const textContents = result.transcript.text.map((item: { _?: string } | string) => {
            // テキスト内容を取得（_が実際のテキスト内容）
            return typeof item === 'object' && item._ ? item._ : 
                   typeof item === 'string' ? item : '';
          });
          
          // 各テキスト要素を改行で結合し、空の要素をフィルタリング
          const formattedText = textContents.join("\n");
          console.log(`[${new Date().toISOString()}] XML字幕テキスト整形完了 - 文字数: ${formattedText.length}`);
          
          return formattedText;
        } 
        // 単一のテキスト要素の場合
        else {
          const text = typeof result.transcript.text === 'object' && result.transcript.text._ ? 
                      result.transcript.text._ : 
                      typeof result.transcript.text === 'string' ? result.transcript.text : '';
          
          console.log(`[${new Date().toISOString()}] XML字幕テキスト整形完了 - 文字数: ${text.length}`);
          return text;
        }
      } else {
        console.warn(`[${new Date().toISOString()}] XML解析結果に字幕テキストが見つかりません`);
        
        // フォールバック: 正規表現で処理
        console.log(`[${new Date().toISOString()}] フォールバック: 正規表現でXMLを処理します`);
        const textElements = captionData.match(/<text[^>]*>(.*?)<\/text>/g) || [];
        
        const textContents = textElements.map(element => {
          // テキスト内容を抽出
          const content = element.replace(/<text[^>]*>(.*?)<\/text>/g, '$1')
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          
          return content;
        });
        
        // 空の要素をフィルタリングし、各テキスト要素を改行で結合
        const formattedText = textContents.join("\n");
        console.log(`[${new Date().toISOString()}] 正規表現によるXML字幕テキスト整形完了 - 文字数: ${formattedText.length}`);
        
        return formattedText;
      }
    } 
    // 通常のテキストデータを処理
    else {
      // XMLタグを削除
      const textLines = captionData
        .replace(/<[^>]*>/g, '')
        .split('\n')
        .filter(line => line.trim() !== ''); // 空行を削除
      
      const formattedText = textLines.join('\n'); // 空白ではなく改行で結合
      console.log(`[${new Date().toISOString()}] 通常字幕テキスト整形完了 - 文字数: ${formattedText.length}`);
      
      return formattedText;
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 字幕テキスト整形エラー:`, error);
    // エラーが発生した場合は元のテキストをそのまま返す
    return captionData;
  }
} 