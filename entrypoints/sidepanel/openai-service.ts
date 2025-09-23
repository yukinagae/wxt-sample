import OpenAI from 'openai';

class OpenAIService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;

  async initialize() {
    try {
      const stored = await chrome.storage.sync.get(['openai_api_key']);
      this.apiKey = stored.openai_api_key;
      
      if (this.apiKey) {
        this.client = new OpenAI({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true
        });
      }
      
      return !!this.client;
    } catch (error) {
      console.error('Failed to initialize OpenAI:', error);
      return false;
    }
  }

  async setApiKey(apiKey: string) {
    try {
      await chrome.storage.sync.set({ openai_api_key: apiKey });
      this.apiKey = apiKey;
      this.client = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true
      });
      return true;
    } catch (error) {
      console.error('Failed to set API key:', error);
      return false;
    }
  }

  async clearApiKey() {
    try {
      await chrome.storage.sync.remove(['openai_api_key']);
      this.apiKey = null;
      this.client = null;
      return true;
    } catch (error) {
      console.error('Failed to clear API key:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.apiKey;
  }

  async sendMessage(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Please set your API key first.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      });

      return response.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          throw new Error('Invalid API key. Please check your OpenAI API key.');
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.message.includes('quota')) {
          throw new Error('API quota exceeded. Please check your OpenAI account.');
        }
      }
      throw new Error('Failed to get response from OpenAI. Please try again.');
    }
  }

  async sendMessageStream(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) {
    if (!this.client) {
      onError('OpenAI client not initialized. Please set your API key first.');
      return;
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
      
      onComplete();
    } catch (error) {
      console.error('OpenAI API streaming error:', error);
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          onError('Invalid API key. Please check your OpenAI API key.');
        } else if (error.message.includes('429')) {
          onError('Rate limit exceeded. Please try again later.');
        } else if (error.message.includes('quota')) {
          onError('API quota exceeded. Please check your OpenAI account.');
        } else {
          onError('Failed to get response from OpenAI. Please try again.');
        }
      } else {
        onError('An unexpected error occurred.');
      }
    }
  }
}

export const openaiService = new OpenAIService();