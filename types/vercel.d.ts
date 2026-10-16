declare module '@vercel/node' {
  export interface VercelRequest {
    method?: string;
    body: unknown;
  }
  export interface VercelResponse {
    setHeader(name: string, value: string): this;
    status(code: number): this;
    json(value: unknown): this;
  }
}
