// Type declarations for Electron API exposed via preload script

export interface FileInfo {
  name: string;
  path: string;
  modifiedTime: string;
}

export interface FileReadResult {
  content: string;
  modifiedTime: string;
}

export interface DialogOptions {
  title?: string;
  defaultPath?: string;
}

export interface WarningDialogOptions {
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
  cancelId?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  detail?: string;
  buttons?: string[];
}

export interface PromptDialogOptions {
  title?: string;
  defaultValue?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface ElectronAPI {
  // Dialog operations
  openFolder: () => Promise<string | null>;
  openFile: (options?: DialogOptions) => Promise<string | null>;
  saveFile: (options?: DialogOptions) => Promise<string | null>;
  showWarning: (options: WarningDialogOptions) => Promise<number>;
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  showPrompt: (options: PromptDialogOptions) => Promise<string | null>;

  // File system operations
  listXmlFiles: (dirPath: string) => Promise<FileInfo[]>;
  readFile: (filePath: string) => Promise<FileReadResult | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  fileExists: (filePath: string) => Promise<boolean>;
  getModifiedTime: (filePath: string) => Promise<string | null>;

  // Window operations
  setTitle: (title: string) => void;

  // Menu event listeners (return cleanup function)
  onMenuOpenWorkspace: (callback: () => void) => () => void;
  onMenuOpenTree: (callback: () => void) => () => void;
  onMenuNewTree: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
  onMenuExport: (callback: () => void) => () => void;
  onMenuUndo: (callback: () => void) => () => void;
  onMenuRedo: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    isElectron?: boolean;
  }
}

export {};
