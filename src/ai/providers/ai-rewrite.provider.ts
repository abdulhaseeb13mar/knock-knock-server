export interface AiRewriteProvider {
  rewriteEmail(input: string, userConfig: { apiKey: string }): Promise<string>;
}
