import {
  loadSnapshot,
  parseImportedBackup,
  saveSnapshot,
  serializeBackup,
  type FinanceSnapshot,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { supabaseProjectsRepository } from "@/services/supabase-projects";

export type { FinanceSnapshot } from "@/lib/storage";
export {
  countLegacyLocalProjects,
  migrateLocalToSupabase,
  hasCompletedCloudMigration,
  markCloudMigrationDone,
} from "@/services/migrate-local";
export type { LocalMigrationResult } from "@/services/migrate-local";

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

export const projectsRepository: ProjectsRepository = isSupabaseConfigured()
  ? supabaseProjectsRepository
  : browserProjectsRepository;
