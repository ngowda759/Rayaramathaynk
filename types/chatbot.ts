export interface ChatbaseConfig {
  chatbotId: string;
  language: string;
  primaryColor?: string;
  buttonColor?: string;
  position?: string;
}

declare global {
  interface Window {
    chatbaseConfig?: ChatbaseConfig;
  }
}
