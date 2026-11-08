// Auth Module Client-Safe Exports
export { resendVerification } from "./resend-verification";

export const loginUser = async (email: string, password: string) => {
  const { authService } = await import("@/services/auth.service");
  return authService.login(email, password);
};
