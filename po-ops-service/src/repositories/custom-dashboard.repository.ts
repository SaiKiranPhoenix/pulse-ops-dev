import type { CustomDashboard, DashboardWidget } from "@pulseops/shared";

export class CustomDashboardRepository {
  private readonly store = new Map<string, CustomDashboard>();

  async list(projectId: string): Promise<CustomDashboard[]> {
    const list = Array.from(this.store.values()).filter((d) => d.projectId === projectId);
    return list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  async findById(projectId: string, id: string): Promise<CustomDashboard | null> {
    const found = this.store.get(id);
    if (!found || found.projectId !== projectId) return null;
    return found;
  }

  async create(
    projectId: string,
    input: {
      readonly name: string;
      readonly description?: string | undefined;
      readonly templateKey?: string | undefined;
      readonly widgets?: DashboardWidget[] | undefined;
      readonly tags?: string[] | undefined;
      readonly refreshIntervalSeconds?: number | undefined;
      readonly isDefault?: boolean | undefined;
    },
  ): Promise<CustomDashboard> {
    const id = `dash_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const doc: CustomDashboard = {
      id,
      projectId,
      name: input.name,
      description: input.description,
      templateKey: input.templateKey,
      widgets: input.widgets ?? [],
      tags: input.tags ?? [],
      refreshIntervalSeconds: input.refreshIntervalSeconds ?? 30,
      isDefault: input.isDefault ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.set(id, doc);
    return doc;
  }

  async update(
    projectId: string,
    id: string,
    input: {
      readonly name?: string | undefined;
      readonly description?: string | undefined;
      readonly templateKey?: string | undefined;
      readonly widgets?: DashboardWidget[] | undefined;
      readonly tags?: string[] | undefined;
      readonly refreshIntervalSeconds?: number | undefined;
      readonly isDefault?: boolean | undefined;
    },
  ): Promise<CustomDashboard | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;

    const updated: CustomDashboard = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      templateKey: input.templateKey !== undefined ? input.templateKey : existing.templateKey,
      widgets: input.widgets ?? existing.widgets,
      tags: input.tags ?? existing.tags,
      refreshIntervalSeconds: input.refreshIntervalSeconds ?? existing.refreshIntervalSeconds,
      isDefault: input.isDefault ?? existing.isDefault,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(id, updated);
    return updated;
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    const existing = await this.findById(projectId, id);
    if (!existing) return false;
    return this.store.delete(id);
  }

  async clone(projectId: string, id: string, newName?: string): Promise<CustomDashboard | null> {
    const existing = await this.findById(projectId, id);
    if (!existing) return null;

    const cloned = await this.create(projectId, {
      name: newName ?? `${existing.name} (Copy)`,
      description: existing.description,
      templateKey: existing.templateKey,
      widgets: existing.widgets,
      tags: existing.tags,
      refreshIntervalSeconds: existing.refreshIntervalSeconds,
      isDefault: false,
    });

    return cloned;
  }
}
