declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
}

declare module "node:child_process" {
  export function execFileSync(
    file: string,
    args?: readonly string[],
    options?: { cwd?: string; stdio?: unknown }
  ): { toString(): string };
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
