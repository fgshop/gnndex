export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: "USER" | "ADMIN";
  iat?: number;
  exp?: number;
};
