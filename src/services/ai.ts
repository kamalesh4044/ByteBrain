import { CreateWebWorkerMLCEngine, type MLCEngineInterface, type InitProgressReport } from '@mlc-ai/web-llm';

class AIService {
  private engine: MLCEngineInterface | null = null;
  private isInitializing = false;
  // Use a capable but small model for broad compatibility and speed
  private modelId = 'Phi-3-mini-4k-instruct-q4f16_1-MLC'; 

  async init(onProgress?: (progress: InitProgressReport) => void): Promise<void> {
    if (this.engine || this.isInitializing) return;
    
    this.isInitializing = true;
    try {
      const worker = new Worker(
        new URL('./worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.engine = await CreateWebWorkerMLCEngine(worker, this.modelId, {
        initProgressCallback: onProgress,
      });
    } catch (error) {
      console.error('Failed to initialize AI Engine:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async deleteModelCache(): Promise<boolean> {
    try {
      const keys = await caches.keys();
      let deleted = false;
      for (const key of keys) {
        if (key.toLowerCase().includes('webllm') || key.toLowerCase().includes('huggingface') || key.toLowerCase().includes('model')) {
          await caches.delete(key);
          deleted = true;
        }
      }
      return deleted;
    } catch (err) {
      console.error('Failed to clear cache', err);
      return false;
    }
  }

  interrupt(): void {
    if (this.engine) {
      this.engine.interruptGenerate();
    }
  }

  async generateResponse(
    userMessage: string, 
    contextFilesText?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('AI Engine not initialized');
    }

    let prompt = userMessage;
    if (contextFilesText) {
      prompt = `Here is the reference material provided by the user:\n\n${contextFilesText}\n\nBased on the above material, please answer the user's prompt:\n${userMessage}`;
    }

    const messages = [
      { role: "system" as const, content: "You are ByteBrain, a helpful, precise, and encouraging AI Study Companion. Answer the user's questions clearly. If they provide reference material (notes/PDF text), base your answers strictly on that material." },
      { role: "user" as const, content: prompt }
    ];

    if (onChunk) {
      const chunks = await this.engine.chat.completions.create({
        messages,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullResponse += delta;
        onChunk(delta);
      }
      return fullResponse;
    } else {
      const reply = await this.engine.chat.completions.create({
        messages,
      });
      return reply.choices[0]?.message?.content || '';
    }
  }
}

export const aiService = new AIService();
