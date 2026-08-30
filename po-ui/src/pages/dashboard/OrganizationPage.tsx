import {
  Building2,
  Check,
  Copy,
  Plus,
  RadioTower,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createOrganization,
  createPersonalAccessToken,
  inviteOrganizationMember,
  listOrganizationMembers,
  listPersonalAccessTokens,
  removeOrganizationMember,
  revokePersonalAccessToken,
  setOrganizationMemberEnvironmentPermission,
  setOrganizationMemberProjectRole,
  updateOrganizationMemberRole,
  type CreatedPersonalAccessToken,
  type OrganizationMember,
  type OrganizationRole,
  type PersonalAccessToken,
  type ProjectPermission,
  type ProtectedEnvironment,
} from "@/features/auth/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useDashboardContext } from "./DashboardLayout";
import { formatRelativeTime } from "./dashboard-utils";

const roleDescriptions: Record<OrganizationRole, string> = {
  owner: "Full administrative access, billing, and ownership transfer.",
  admin: "Can manage members, projects, API keys, and environment permissions.",
  developer: "Can write logs/metrics/errors and deploy to dev/staging environments.",
  viewer: "Read-only access to dashboards, logs, traces, and non-sensitive metrics.",
};

export function OrganizationPage() {
  const {
    organizations,
    selectedOrganization,
    refreshOrganizations,
    projects,
    setSelectedOrganizationId,
  } = useDashboardContext();
  const { notify } = useToast();

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Invite state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("developer");
  const [isInviting, setIsInviting] = useState(false);

  // Create Org state
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Member editing modals
  const [selectedMemberForProjectRole, setSelectedMemberForProjectRole] =
    useState<OrganizationMember | null>(null);
  const [selectedMemberForEnvPerms, setSelectedMemberForEnvPerms] =
    useState<OrganizationMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<OrganizationMember | null>(null);

  // PAT state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenExpiryDays, setTokenExpiryDays] = useState("30");
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [createdTokenRaw, setCreatedTokenRaw] = useState<CreatedPersonalAccessToken | null>(null);
  const [tokenToRevoke, setTokenToRevoke] = useState<PersonalAccessToken | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const canManage =
    selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";

  useEffect(() => {
    if (!selectedOrganization) return;
    let isMounted = true;

    async function loadData() {
      if (!selectedOrganization) return;
      setIsLoadingMembers(true);
      setMemberError(null);
      try {
        const [memberList, tokenList] = await Promise.all([
          listOrganizationMembers(selectedOrganization.id),
          listPersonalAccessTokens(selectedOrganization.id),
        ]);
        if (!isMounted) return;
        setMembers(memberList);
        setTokens(tokenList);
      } catch (err) {
        if (!isMounted) return;
        setMemberError(getApiErrorMessage(err));
      } finally {
        if (isMounted) setIsLoadingMembers(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedOrganization]);

  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreatingOrg(true);
    try {
      const created = await createOrganization({
        name: newOrgName.trim(),
        ...(newOrgSlug.trim() ? { slug: newOrgSlug.trim() } : {}),
      });
      await refreshOrganizations(created.id);
      setSelectedOrganizationId(created.id);
      setNewOrgName("");
      setNewOrgSlug("");
      setIsCreateOrgModalOpen(false);
      notify({ title: "Workspace created", description: created.name, variant: "success" });
    } catch (err) {
      notify({
        title: "Failed to create workspace",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsCreatingOrg(false);
    }
  }

  async function handleInviteMember(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrganization || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const member = await inviteOrganizationMember(selectedOrganization.id, {
        email: inviteEmail.trim(),
        displayName: inviteDisplayName.trim() || null,
        role: inviteRole,
      });
      setMembers((prev) => [...prev.filter((m) => m.id !== member.id), member]);
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteRole("developer");
      setIsInviteModalOpen(false);
      notify({
        title: "Invitation sent",
        description: `Invited ${member.email} as ${member.role}`,
        variant: "success",
      });
    } catch (err) {
      notify({
        title: "Failed to invite member",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleUpdateMemberRole(member: OrganizationMember, nextRole: OrganizationRole) {
    if (!selectedOrganization) return;
    try {
      const updated = await updateOrganizationMemberRole(
        selectedOrganization.id,
        member.id,
        nextRole,
      );
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      notify({
        title: "Role updated",
        description: `${member.displayName ?? member.email} is now ${nextRole}`,
        variant: "success",
      });
    } catch (err) {
      notify({
        title: "Failed to update role",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleSetProjectRole(
    member: OrganizationMember,
    projectId: string,
    permission: ProjectPermission | null,
  ) {
    if (!selectedOrganization) return;
    try {
      const updated = await setOrganizationMemberProjectRole(
        selectedOrganization.id,
        member.id,
        projectId,
        permission,
      );
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMemberForProjectRole(updated);
      notify({ title: "Project permissions updated", variant: "success" });
    } catch (err) {
      notify({
        title: "Failed to set project role",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleSetEnvPerm(
    member: OrganizationMember,
    environment: ProtectedEnvironment,
    permissions: { canRead: boolean; canWrite: boolean; canRevealSecrets: boolean },
  ) {
    if (!selectedOrganization) return;
    try {
      const updated = await setOrganizationMemberEnvironmentPermission(
        selectedOrganization.id,
        member.id,
        environment,
        permissions,
      );
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMemberForEnvPerms(updated);
      notify({ title: `${environment} permissions updated`, variant: "success" });
    } catch (err) {
      notify({
        title: "Failed to update environment permissions",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    }
  }

  async function handleRemoveMember() {
    if (!selectedOrganization || !memberToDelete) return;
    try {
      await removeOrganizationMember(selectedOrganization.id, memberToDelete.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      notify({
        title: "Member removed",
        description: `${memberToDelete.displayName ?? memberToDelete.email} has been removed from workspace`,
        variant: "info",
      });
    } catch (err) {
      notify({
        title: "Failed to remove member",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setMemberToDelete(null);
    }
  }

  async function handleCreateToken(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrganization || !tokenName.trim()) return;
    setIsCreatingToken(true);
    try {
      const days = Number.parseInt(tokenExpiryDays, 10);
      const expiresAt =
        Number.isFinite(days) && days > 0
          ? new Date(Date.now() + days * 86_400_000).toISOString()
          : null;

      const created = await createPersonalAccessToken(selectedOrganization.id, {
        name: tokenName.trim(),
        scopes: ["api:read", "api:write"],
        expiresAt,
      });

      setCreatedTokenRaw(created);
      setTokens((prev) => [created.token, ...prev]);
      setTokenName("");
      notify({ title: "Personal access token created", variant: "success" });
    } catch (err) {
      notify({
        title: "Failed to create access token",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsCreatingToken(false);
    }
  }

  async function handleRevokeToken() {
    if (!selectedOrganization || !tokenToRevoke) return;
    try {
      const revoked = await revokePersonalAccessToken(selectedOrganization.id, tokenToRevoke.id);
      setTokens((prev) => prev.map((t) => (t.id === revoked.id ? revoked : t)));
      notify({ title: "Token revoked", variant: "info" });
    } catch (err) {
      notify({
        title: "Failed to revoke token",
        description: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setTokenToRevoke(null);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Workspace Overview Card ── */}
      <div className="card-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  {selectedOrganization?.name ?? "PulseOps Workspace"}
                </h1>
                {selectedOrganization ? (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider",
                      selectedOrganization.role === "owner" &&
                        "bg-amber-100 text-amber-800 border border-amber-300",
                      selectedOrganization.role === "admin" &&
                        "bg-indigo-100 text-indigo-800 border border-indigo-300",
                      selectedOrganization.role === "developer" &&
                        "bg-emerald-100 text-emerald-800 border border-emerald-300",
                      selectedOrganization.role === "viewer" &&
                        "bg-slate-100 text-slate-700 border border-slate-300",
                    )}
                  >
                    {selectedOrganization.role}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Slug: <code className="font-mono">{selectedOrganization?.slug ?? "default"}</code> ·{" "}
                {members.length} members · {projects.length} projects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="w-auto gap-1.5"
              onClick={() => setIsCreateOrgModalOpen(true)}
              type="button"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
            {canManage ? (
              <Button
                className="w-auto gap-1.5"
                onClick={() => setIsInviteModalOpen(true)}
                type="button"
                variant="primary"
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            ) : null}
          </div>
        </div>

        {/* Workspace Switcher Pills */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Workspaces:</span>
          {organizations.map((org) => (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                org.id === selectedOrganization?.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted hover:bg-accent text-foreground",
              )}
              key={org.id}
              onClick={() => setSelectedOrganizationId(org.id)}
              type="button"
            >
              <Building2 className="h-3 w-3" />
              {org.name}
              <span className="text-[10px] opacity-75">({org.role})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Team Members & Access Control Table ── */}
      <div className="card-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Team Members & Role-Based Access</h2>
            <p className="text-xs text-muted-foreground">
              Manage organization roles, project-level overrides, and environment access per team
              member.
            </p>
          </div>
        </div>

        {memberError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {memberError}
          </div>
        ) : null}

        {isLoadingMembers ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="skeleton h-14 rounded-lg" key={i} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No team members found in this workspace.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Member</th>
                  <th className="py-2.5 px-3 font-semibold">Organization Role</th>
                  <th className="py-2.5 px-3 font-semibold">Project Overrides</th>
                  <th className="py-2.5 px-3 font-semibold">Environment Security</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  {canManage ? (
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => {
                  const initial = (member.displayName ?? member.email).charAt(0).toUpperCase();
                  return (
                    <tr className="hover:bg-accent/40 transition-colors" key={member.id}>
                      {/* User identity */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                            {initial}
                          </span>
                          <div>
                            <p className="font-semibold text-foreground">
                              {member.displayName ?? member.email.split("@")[0]}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Organization Role */}
                      <td className="py-3 px-3">
                        {canManage && member.role !== "owner" ? (
                          <select
                            aria-label={`Role for ${member.displayName ?? member.email}`}
                            className="h-7 appearance-none rounded border border-border bg-background px-2 text-xs font-medium capitalize"
                            onChange={(e) =>
                              handleUpdateMemberRole(member, e.target.value as OrganizationRole)
                            }
                            value={member.role}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="developer">Developer</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[11px] font-semibold capitalize",
                              member.role === "owner" && "bg-amber-100 text-amber-800",
                              member.role === "admin" && "bg-indigo-100 text-indigo-800",
                              member.role === "developer" && "bg-emerald-100 text-emerald-800",
                              member.role === "viewer" && "bg-slate-100 text-slate-700",
                            )}
                          >
                            {member.role}
                          </span>
                        )}
                      </td>

                      {/* Project Role Overrides */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {member.projectRoles.length === 0
                              ? "Default"
                              : `${member.projectRoles.length} custom`}
                          </span>
                          {canManage ? (
                            <Button
                              className="h-6 w-auto px-2 text-[10px]"
                              onClick={() => setSelectedMemberForProjectRole(member)}
                              type="button"
                              variant="outline"
                            >
                              Configure
                            </Button>
                          ) : null}
                        </div>
                      </td>

                      {/* Environment security */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {member.environmentPermissions.length === 0
                              ? "Role defaults"
                              : `${member.environmentPermissions.length} rules`}
                          </span>
                          {canManage ? (
                            <Button
                              className="h-6 w-auto px-2 text-[10px]"
                              onClick={() => setSelectedMemberForEnvPerms(member)}
                              type="button"
                              variant="outline"
                            >
                              Rules
                            </Button>
                          ) : null}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            member.status === "active" &&
                              "bg-emerald-50 text-emerald-700 border border-emerald-200",
                            member.status === "invited" &&
                              "bg-amber-50 text-amber-700 border border-amber-200",
                            member.status === "removed" &&
                              "bg-slate-100 text-slate-600 border border-slate-200",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              member.status === "active" && "bg-emerald-500",
                              member.status === "invited" && "bg-amber-500",
                              member.status === "removed" && "bg-slate-400",
                            )}
                          />
                          {member.status}
                        </span>
                      </td>

                      {/* Actions */}
                      {canManage ? (
                        <td className="py-3 px-3 text-right">
                          {member.role !== "owner" ? (
                            <Button
                              aria-label={`Remove ${member.email}`}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setMemberToDelete(member)}
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Personal Access Tokens (PATs) Section ── */}
      <div className="card-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Workspace Access Tokens (PATs)</h2>
            <p className="text-xs text-muted-foreground">
              Programmatic bearer tokens scoped to this workspace for CI/CD runners and scripts.
            </p>
          </div>
          <Button
            className="w-auto gap-1.5"
            onClick={() => setIsTokenModalOpen(true)}
            type="button"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Generate Token
          </Button>
        </div>

        {/* One-time token reveal alert */}
        {createdTokenRaw ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">
                ✓ Copy your personal access token now (it won't be shown again)
              </span>
              <button
                className="text-emerald-700 hover:text-emerald-900"
                onClick={() => setCreatedTokenRaw(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-emerald-200">
              <code className="flex-1 font-mono text-xs text-emerald-800 break-all select-all">
                {createdTokenRaw.rawToken}
              </code>
              <Button
                className="h-7 w-auto px-2.5"
                onClick={() => {
                  navigator.clipboard.writeText(createdTokenRaw.rawToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                type="button"
                variant="outline"
              >
                {copiedToken ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedToken ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No personal access tokens generated.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {tokens.map((token) => (
              <div className="flex items-center justify-between p-3 text-xs" key={token.id}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{token.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                      {token.tokenPrefix}…
                    </code>
                    {token.status === "revoked" ? (
                      <span className="text-[10px] font-semibold text-destructive">revoked</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600">active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Created {formatRelativeTime(token.createdAt)} ·{" "}
                    {token.expiresAt
                      ? `Expires ${formatRelativeTime(token.expiresAt)}`
                      : "No expiry"}
                  </p>
                </div>
                {token.status === "active" ? (
                  <Button
                    className="h-7 w-auto text-destructive hover:bg-destructive/10"
                    onClick={() => setTokenToRevoke(token)}
                    type="button"
                    variant="ghost"
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Invite Member Modal ── */}
      {isInviteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-surface w-full max-w-md p-6 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Invite Team Member</h3>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsInviteModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3.5" onSubmit={handleInviteMember}>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Email address
                </label>
                <Input
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  required
                  type="email"
                  value={inviteEmail}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Display Name (optional)
                </label>
                <Input
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  placeholder="Alice Smith"
                  value={inviteDisplayName}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Organization Role
                </label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium"
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  value={inviteRole}
                >
                  <option value="admin">Admin — Full member & project management</option>
                  <option value="developer">Developer — Read/write to dev and staging</option>
                  <option value="viewer">Viewer — Read-only access</option>
                  <option value="owner">Owner — Workspace owner</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {roleDescriptions[inviteRole]}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  className="w-auto"
                  onClick={() => setIsInviteModalOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button className="w-auto" disabled={isInviting} type="submit" variant="primary">
                  {isInviting ? "Inviting…" : "Send Invitation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Create Workspace Modal ── */}
      {isCreateOrgModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-surface w-full max-w-md p-6 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Create New Workspace</h3>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsCreateOrgModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3.5" onSubmit={handleCreateOrg}>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Workspace Name
                </label>
                <Input
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Acme Corp Operations"
                  required
                  value={newOrgName}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Custom Slug (optional)
                </label>
                <Input
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  placeholder="acme-ops"
                  value={newOrgSlug}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  className="w-auto"
                  onClick={() => setIsCreateOrgModalOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button className="w-auto" disabled={isCreatingOrg} type="submit" variant="primary">
                  {isCreatingOrg ? "Creating…" : "Create Workspace"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Project Role Overrides Modal ── */}
      {selectedMemberForProjectRole ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-surface w-full max-w-lg p-6 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Project Role Overrides</h3>
                <p className="text-xs text-muted-foreground">
                  Overrides for{" "}
                  {selectedMemberForProjectRole.displayName ?? selectedMemberForProjectRole.email}{" "}
                  (Org role: {selectedMemberForProjectRole.role})
                </p>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedMemberForProjectRole(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border max-h-72 overflow-y-auto">
              {projects.map((proj) => {
                const currentOverride = selectedMemberForProjectRole.projectRoles.find(
                  (r) => r.projectId === proj.id,
                );
                return (
                  <div className="flex items-center justify-between p-3 text-xs" key={proj.id}>
                    <div>
                      <span className="font-semibold text-foreground">{proj.name}</span>
                      <p className="text-[11px] text-muted-foreground font-mono">{proj.slug}</p>
                    </div>
                    <select
                      className="h-7 rounded border border-border bg-background px-2 text-xs font-medium"
                      onChange={(e) => {
                        const val = e.target.value as ProjectPermission | "default";
                        handleSetProjectRole(
                          selectedMemberForProjectRole,
                          proj.id,
                          val === "default" ? null : val,
                        );
                      }}
                      value={currentOverride?.permission ?? "default"}
                    >
                      <option value="default">Default ({selectedMemberForProjectRole.role})</option>
                      <option value="read">Read Only</option>
                      <option value="write">Read & Write</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="w-auto"
                onClick={() => setSelectedMemberForProjectRole(null)}
                type="button"
                variant="primary"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Environment Permissions Modal ── */}
      {selectedMemberForEnvPerms ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-surface w-full max-w-lg p-6 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Environment Security Rules</h3>
                <p className="text-xs text-muted-foreground">
                  Granular environment access for{" "}
                  {selectedMemberForEnvPerms.displayName ?? selectedMemberForEnvPerms.email}
                </p>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedMemberForEnvPerms(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {(["development", "staging", "production"] as const).map((env) => {
                const currentRule = selectedMemberForEnvPerms.environmentPermissions.find(
                  (p) => p.environment === env,
                );
                const canRead = currentRule ? currentRule.canRead : true;
                const canWrite = currentRule
                  ? currentRule.canWrite
                  : selectedMemberForEnvPerms.role !== "viewer";
                const canRevealSecrets = currentRule
                  ? currentRule.canRevealSecrets
                  : selectedMemberForEnvPerms.role === "owner" ||
                    selectedMemberForEnvPerms.role === "admin";

                return (
                  <div
                    className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                    key={env}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs capitalize text-foreground flex items-center gap-1.5">
                        <RadioTower className="h-3.5 w-3.5 text-indigo-500" />
                        {env} Environment
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          checked={canRead}
                          className="rounded border-border"
                          onChange={(e) =>
                            handleSetEnvPerm(selectedMemberForEnvPerms, env, {
                              canRead: e.target.checked,
                              canWrite,
                              canRevealSecrets,
                            })
                          }
                          type="checkbox"
                        />
                        <span>Can Read</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          checked={canWrite}
                          className="rounded border-border"
                          onChange={(e) =>
                            handleSetEnvPerm(selectedMemberForEnvPerms, env, {
                              canRead,
                              canWrite: e.target.checked,
                              canRevealSecrets,
                            })
                          }
                          type="checkbox"
                        />
                        <span>Can Write</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          checked={canRevealSecrets}
                          className="rounded border-border"
                          onChange={(e) =>
                            handleSetEnvPerm(selectedMemberForEnvPerms, env, {
                              canRead,
                              canWrite,
                              canRevealSecrets: e.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <span className="text-amber-700">Reveal Secrets</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="w-auto"
                onClick={() => setSelectedMemberForEnvPerms(null)}
                type="button"
                variant="primary"
              >
                Save & Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Generate Token Modal ── */}
      {isTokenModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-surface w-full max-w-md p-6 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Generate Access Token</h3>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsTokenModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3.5" onSubmit={handleCreateToken}>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Token Name
                </label>
                <Input
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="CI / GitHub Actions"
                  required
                  value={tokenName}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Expiration
                </label>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-medium"
                  onChange={(e) => setTokenExpiryDays(e.target.value)}
                  value={tokenExpiryDays}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="0">No expiration (Permanent)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  className="w-auto"
                  onClick={() => setIsTokenModalOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="w-auto"
                  disabled={isCreatingToken}
                  type="submit"
                  variant="primary"
                >
                  {isCreatingToken ? "Generating…" : "Generate Token"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Remove Member Confirm Dialog ── */}
      <ConfirmDialog
        confirmLabel="Remove member"
        description={`Are you sure you want to remove ${memberToDelete?.displayName ?? memberToDelete?.email} from this workspace? They will lose access to all projects immediately.`}
        isOpen={memberToDelete !== null}
        onCancel={() => setMemberToDelete(null)}
        onConfirm={handleRemoveMember}
        title="Remove team member?"
      />

      {/* ── Revoke Token Confirm Dialog ── */}
      <ConfirmDialog
        confirmLabel="Revoke token"
        description={`Revoking "${tokenToRevoke?.name}" will instantly block all automated requests using this token.`}
        isOpen={tokenToRevoke !== null}
        onCancel={() => setTokenToRevoke(null)}
        onConfirm={handleRevokeToken}
        title="Revoke access token?"
      />
    </div>
  );
}
