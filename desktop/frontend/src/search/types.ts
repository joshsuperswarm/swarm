export type UrlCitation = {
  type: "url_citation";
  title?: string | null;
  url: string;
  index?: number | null;
};

export type OutputText = {
  type: "output_text";
  text: string;
  annotations?: UrlCitation[];
};

export type OutputMessage = {
  type: "message";
  role: "assistant" | "user" | string;
  content: Array<OutputText | Record<string, unknown>>;
};

export type WebSearchCall = {
  type: "web_search_call";
  id?: string;
  status?: string;
};

export type ResponseOutputItem =
  | OutputMessage
  | WebSearchCall
  | Record<string, unknown>;

export type ResponsesApiPayload = {
  id: string;
  model: string;
  output: ResponseOutputItem[];
  output_text?: string;
};

export type ParsedCitation = {
  url: string;
  domain: string;
  title?: string | null;
  index?: number | null;
};