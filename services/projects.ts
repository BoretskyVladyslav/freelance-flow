import {
  loadSnapshot,
  parseImportedBackup,
  saveSnapshot,
  serializeBackup,
  type FinanceSnapshot,
} from "@/lib/storage";

export type { FinanceSnapshot } from "@/lib/storage";

export interface ProjectsRepository {
  load(): Promise<FinanceSnapshot>;
  save(snapshot: FinanceSnapshot): Promise<void>;
  serializeBackup(snapshot: FinanceSnapshot): string;
  parseBackup(raw: string): FinanceSnapshot;
}

export const browserProjectsRepository: ProjectsRepository = {
  load: loadSnapshot,
  save: saveSnapshot,
  serializeBackup,
  parseBackup: parseImportedBackup,
};

