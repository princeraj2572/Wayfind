"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useMe, useMembers, useRemoveMember, useSetMemberRole, useSpaces } from "@/lib/queries";
import type { Member, Role } from "@/lib/types";

const ROLES: Role[] = ["viewer", "editor", "admin"];
const select =
  "h-9 rounded-lg border border-[#cfd3e3] bg-white px-2 text-sm text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/40 disabled:opacity-60";

function addErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 404 ? "No account with that email. They need to register first." : err.message;
  }
  return "Could not add the member.";
}

export function MembersView({ spaceId }: { spaceId: number }) {
  const router = useRouter();
  const me = useMe();
  const spaces = useSpaces();
  const members = useMembers(spaceId);
  const setRole = useSetMemberRole(spaceId);
  const remove = useRemoveMember(spaceId);

  const [rowError, setRowError] = useState<string | null>(null);
  const [target, setTarget] = useState<Member | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [demote, setDemote] = useState<{ member: Member; role: Role } | null>(null);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("editor");
  const [addError, setAddError] = useState<string | null>(null);

  const space = spaces.data?.find((s) => s.id === spaceId);

  if (leaving || spaces.isPending || me.isPending || members.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (spaces.isError) return <ErrorState title="Couldn't load your spaces" message={spaces.error.message} />;
  if (!space) return <ErrorState title="Space not found" message="It may not exist, or you may not have access to it." />;
  if (members.isError) return <ErrorState title="Couldn't load members" message={members.error.message} />;

  const isAdmin = space.role === "admin";

  function changeRole(member: Member, role: Role) {
    if (member.user_id === me.data?.id && role !== "admin") {
      setDemote({ member, role });
      return;
    }
    applyRole(member, role);
  }

  function applyRole(member: Member, role: Role) {
    setRowError(null);
    setRole.mutate(
      { email: member.email, role },
      { onError: (err) => setRowError(err instanceof ApiError ? err.message : "Could not change the role.") },
    );
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);
    setRowError(null);
    if (email.trim().toLowerCase() === me.data?.email.toLowerCase()) {
      // Adding yourself would change your own role: treat it exactly like using your row's role select.
      const own = members.data?.find((m) => m.user_id === me.data?.id);
      if (own) {
        changeRole(own, newRole);
        setEmail("");
        return;
      }
    }
    try {
      await setRole.mutateAsync({ email: email.trim(), role: newRole });
      setEmail("");
    } catch (err) {
      setAddError(addErrorText(err));
    }
  }

  async function confirmRemove() {
    if (!target) return;
    const self = target.user_id === me.data?.id;
    setRemoveError(null);
    setRowError(null);
    try {
      await remove.mutateAsync(target.user_id);
      setTarget(null);
      if (self) {
        setLeaving(true);
        router.replace("/ask");
      }
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : "Could not remove the member.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/s/${spaceId}`} className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        <span className="max-w-64 truncate">{space.name}</span>
      </Link>
      <h1 className="mt-2 text-xl font-bold tracking-tight">Members</h1>
      <p className="mt-1 text-sm text-mute">
        {isAdmin
          ? "Admins manage who can read, edit and administer this space."
          : "Everyone listed here can read this space. Only admins can change it."}
      </p>

      {rowError ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {rowError}
        </p>
      ) : null}

      <ul aria-label="Members" className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {members.data.map((member) => {
          const isMe = member.user_id === me.data?.id;
          return (
            <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 break-words text-sm font-medium">{member.email}</span>
              {isMe ? <Badge tone="brand">You</Badge> : null}
              {isAdmin ? (
                <>
                  <select
                    aria-label={`Role for ${member.email}`}
                    value={member.role}
                    disabled={setRole.isPending}
                    onChange={(e) => changeRole(member, e.target.value as Role)}
                    className={select}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="danger"
                    size="sm"
                    aria-label={`Remove ${member.email}`}
                    onClick={() => {
                      setRemoveError(null);
                      setTarget(member);
                    }}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Badge tone="gray">{member.role}</Badge>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin ? (
        <form aria-label="Add member" onSubmit={onAdd} className="mt-6 rounded-xl border border-line bg-panel p-4">
          <h2 className="text-sm font-semibold">Add member</h2>
          <p className="mt-0.5 text-xs text-mute">The person needs a Wayfind account already.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <label htmlFor="member-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="member-email"
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="member-role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="member-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className={`${select} h-10`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={setRole.isPending || !email.trim()}>
              Add member
            </Button>
          </div>
          {addError ? (
            <p role="alert" className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {addError}
            </p>
          ) : null}
        </form>
      ) : null}

      <Dialog open={demote !== null} onOpenChange={(next) => (next ? undefined : setDemote(null))}>
        <DialogContent
          title="Change your own role?"
          description="You will lose the ability to manage members and see analytics for this space. Another admin would have to restore it."
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                if (demote) applyRole(demote.member, demote.role);
                setDemote(null);
              }}
            >
              Change role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) {
            setTarget(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogContent
          title={`Remove ${target?.email ?? ""}?`}
          description={
            target?.user_id === me.data?.id
              ? "You will lose access to this space and it will disappear from your list."
              : "They will lose access to this space."
          }
        >
          {removeError ? (
            <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {removeError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="danger" disabled={remove.isPending} onClick={() => void confirmRemove()}>
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
