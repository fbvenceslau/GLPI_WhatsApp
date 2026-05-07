// Pacotes AdminJS (ESM-only) carregados via dynamic import — declarações mínimas.
declare module '@adminjs/sequelize' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Resource: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Database: any;
}

declare module '@adminjs/express' {
  import type { Router } from 'express';
  import type AdminJS from 'adminjs';

  interface AuthOptions {
    authenticate: (email: string, password: string) => Promise<object | null>;
    cookieName: string;
    cookiePassword: string;
  }

  interface SessionOptions {
    resave: boolean;
    saveUninitialized: boolean;
    secret: string;
  }

  const AdminJSExpress: {
    buildAuthenticatedRouter(
      admin: AdminJS,
      auth: AuthOptions,
      router: Router | null,
      sessionOptions?: SessionOptions
    ): Router;
  };

  export default AdminJSExpress;
}
