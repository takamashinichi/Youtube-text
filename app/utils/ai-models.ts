// 利用可能なAIモデルの定義
export const ALLOWED_MODELS = [
  'gpt-3.5-turbo', 
  'gpt-4', 
  'gpt-4-turbo',
  'gemini-1.5-pro',
  'claude-3-opus',
  'claude-3-5-sonnet'
] as const;

// モデル名から実際のAPIで使用するモデル名へのマッピング
export const MODEL_MAPPING: Record<string, string> = {
  // OpenAIモデル
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
  'gpt-4': 'gpt-4',
  'gpt-4-turbo': 'gpt-4-turbo',
  
  // Geminiモデル
  'gemini-1.5-pro': 'gemini-1.5-pro-latest',
  
  // Claudeモデル
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022'
};

// モデルの表示名と説明
export const AI_MODELS = [
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '高速で経済的' },
  { id: 'gpt-4', name: 'GPT-4', description: '高精度で詳細な分析が可能' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '最新のGPT-4モデル' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Googleの最新AI、高速で正確' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', description: '最高精度のAI、複雑な分析が得意' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: '高速で経済的なClaude' },
] as const;

// モデル名からマッピングされた実際のモデル名を取得する関数
export function getActualModelName(model: string): string {
  return MODEL_MAPPING[model] || model;
} 