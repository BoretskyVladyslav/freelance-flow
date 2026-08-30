"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { sanitizeEmail } from "@/lib/auth/credentials";
import { ROLE_LABELS, STATUS_ACCOUNT_LABELS } from "@/lib/labels";
import type { UserRole } from "@/types/database";
import type { TeamMember } from "@/types/team";

const ROLE_ITEMS = {
  employee: ROLE_LABELS.employee,
  admin: ROLE_LABELS.admin,
} as const;

type FormState = {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

const EMPTY_FORM: FormState = {
  email: "",
  password: "",
  fullName: "",
  role: "employee",
};

export function TeamPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/team");
      const payload = (await response.json()) as { members?: TeamMember[]; error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Не вдалося завантажити команду.");
        return;
      }
      setMembers(payload.members ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: sanitizeEmail(form.email),
          password: form.password,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "Не вдалося додати працівника.");
        return;
      }
      toast.success("Працівника додано.");
      setForm(EMPTY_FORM);
      setOpen(false);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="min-w-0 overflow-x-hidden print:hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Команда / Працівники</CardTitle>
        <Button type="button" onClick={() => setOpen(true)}>
          Додати працівника
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Імʼя</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead className="hidden sm:table-cell">Створено</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Завантаження…
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Немає працівників.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.fullName || "—"}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(member.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={member.status === "active" ? "secondary" : "destructive"}>
                      {STATUS_ACCOUNT_LABELS[member.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(event) => void onCreate(event)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Додати працівника</DialogTitle>
              <DialogDescription>
                Обліковий запис створюється адміністратором. Публічна реєстрація вимкнена.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="team-email">Email</Label>
              <Input
                id="team-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                lang="en"
                required
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="team-password">Початковий пароль</Label>
              <Input
                id="team-password"
                name="password"
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="team-name">Повне імʼя</Label>
              <Input
                id="team-name"
                required
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="team-role">Роль</Label>
              <Select
                value={form.role}
                items={ROLE_ITEMS}
                onValueChange={(value) => {
                  if (value === "admin" || value === "employee") {
                    setForm((current) => ({ ...current, role: value }));
                  }
                }}
              >
                <SelectTrigger id="team-role" className="w-full min-w-40">
                  <SelectValue>
                    {(value: string | null) =>
                      value && value in ROLE_ITEMS
                        ? ROLE_ITEMS[value as keyof typeof ROLE_ITEMS]
                        : ROLE_LABELS.employee
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="employee">Працівник</SelectItem>
                  <SelectItem value="admin">Адмін</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button type="submit" disabled={submitting}>
                Створити
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
