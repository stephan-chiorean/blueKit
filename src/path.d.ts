declare module 'path' {
  export function dirname(p: string): string;
  export function resolve(...paths: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function extname(p: string): string;
  export function join(...paths: string[]): string;
  
  const path: {
    dirname: typeof dirname;
    resolve: typeof resolve;
    basename: typeof basename;
    extname: typeof extname;
    join: typeof join;
  };
  
  export default path;
}

