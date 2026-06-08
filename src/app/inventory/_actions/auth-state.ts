export type LoginActionState = {
  error: string | null;
};

export const initialLoginActionState: LoginActionState = {
  error: null,
};

export type ForgotPasswordActionState = {
  error: string | null;
  success: boolean;
};

export const initialForgotPasswordActionState: ForgotPasswordActionState = {
  error: null,
  success: false,
};
