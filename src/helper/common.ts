import { statSync } from 'fs';

export const isFile = (path: string) => {
  return statSync(path).isFile();
};

export const isDirectory = (path: string) => {
  return statSync(path).isDirectory();
};

export const log = console.log;
