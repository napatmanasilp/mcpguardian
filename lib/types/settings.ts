export interface ActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}
