import type { PassageRef } from '../domain/references/types.js';
import {
  createResearchTrail,
  currentResearchLocation,
  goBack,
  goForward,
  pushResearchLocation,
  type WorkspaceState,
} from '../domain/studies/index.js';
import type { SelahRepository } from '../persistence/types.js';

export interface WorkspaceServiceOptions {
  idFactory?: () => string;
  now?: () => number;
}

export class WorkspaceService {
  readonly #idFactory: () => string;
  readonly #now: () => number;

  constructor(private readonly repository: SelahRepository, options: WorkspaceServiceOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? Date.now;
  }

  async create(passage: PassageRef, translationId = 'BSB', studyId?: string): Promise<WorkspaceState> {
    const workspace: WorkspaceState = {
      id: this.#idFactory(),
      primaryPassage: structuredClone(passage),
      translationId,
      panes: [{ id: 'primary-study', tool: 'guide', follow: 'passage', size: 44 }],
      researchTrail: createResearchTrail({ passage: structuredClone(passage) }),
      updatedAt: this.#now(),
      ...(studyId ? { studyId } : {}),
    };
    await this.repository.putWorkspace(workspace);
    return workspace;
  }

  async navigate(workspace: WorkspaceState, passage: PassageRef): Promise<WorkspaceState> {
    const updated: WorkspaceState = {
      ...workspace,
      primaryPassage: structuredClone(passage),
      researchTrail: pushResearchLocation(workspace.researchTrail, { passage: structuredClone(passage) }),
      updatedAt: this.#now(),
    };
    await this.repository.putWorkspace(updated);
    return updated;
  }

  async back(workspace: WorkspaceState): Promise<WorkspaceState> {
    const trail = goBack(workspace.researchTrail);
    const location = currentResearchLocation(trail);
    if (!location) return workspace;
    const updated = { ...workspace, primaryPassage: structuredClone(location.passage), researchTrail: trail, updatedAt: this.#now() };
    await this.repository.putWorkspace(updated);
    return updated;
  }

  async forward(workspace: WorkspaceState): Promise<WorkspaceState> {
    const trail = goForward(workspace.researchTrail);
    const location = currentResearchLocation(trail);
    if (!location) return workspace;
    const updated = { ...workspace, primaryPassage: structuredClone(location.passage), researchTrail: trail, updatedAt: this.#now() };
    await this.repository.putWorkspace(updated);
    return updated;
  }

  async restoreLast(): Promise<WorkspaceState | undefined> {
    const metadata = await this.repository.getMetadata();
    if (metadata.lastOpenedWorkspaceId) return this.repository.getWorkspace(metadata.lastOpenedWorkspaceId);
    return (await this.repository.listWorkspaces()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  async markLastOpened(workspace: WorkspaceState): Promise<void> {
    const metadata = await this.repository.getMetadata();
    await this.repository.setMetadata({ ...metadata, lastOpenedWorkspaceId: workspace.id, updatedAt: this.#now() });
  }
}
