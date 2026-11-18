# Permissions

Source of truth: `src/lib/permissions/definitions.ts` (catalogue + `can()`), synced into the
`roles`, `permissions`, `role_permissions` tables by `npm run db:seed` / `syncRbac()`.
Resource scoping: `src/lib/permissions/scopes.ts`. Both are unit-tested.

## Roles

| | Super Admin | Admin | User |
|---|---|---|---|
| How created | `npm run bootstrap:admin` (once) | by a Super Admin | by Super Admin or an Admin with `members.manage` |
| Permissions | **all, always** (hard-coded in `can()`) | editable by Super Admin | editable by Super Admin |

## Permission catalogue (defaults)

| Key | Admin | User | Notes |
|---|:-:|:-:|---|
| dashboard.view | ✔ | ✔ | |
| projects.view_all | | | Without it, projects are limited to those the user manages, created, belongs to, or has tasks in |
| projects.create / edit / archive / post_status | ✔ | | edit / archive / post_status only on *manageable* projects |
| departments.manage | ✔ | | |
| members.view | ✔ | | Users only see their own profile |
| members.manage | ✔ | | Admins may only create/edit **User**-role accounts |
| tasks.view_all | | | |
| tasks.create / tasks.manage | ✔ | | Only within manageable projects (or tasks they created) |
| tasks.update_assigned | ✔ | ✔ | Status/progress of tasks assigned to the user; cannot cancel |
| tasks.comment | ✔ | ✔ | On visible tasks |
| reports.view | ✔ | | Project / department / member / global lists within the user's access |
| reports.own | ✔ | ✔ | Own member task list + visible single tasks |
| users.manage_admins 🔒 | | | Create admins, change roles |
| settings.company 🔒 | | | |
| settings.roles 🔒 | | | |
| audit.view 🔒 | | | |

🔒 = super-admin-only: `can()` refuses them for other roles even if a database row exists,
and the role editor refuses to grant them.

## Resource scopes

| Resource | Super Admin / `*.view_all` | Admin (default) | User |
|---|---|---|---|
| Project visible | all in org | manager, creator, member, or has an assigned task | same rule (member / assigned task) |
| Project manageable | all | manager, creator or member | — |
| Task visible | all | assigned, owner, creator, or in a manageable project | assigned or owner |
| Task manageable (`tasks.manage`) | all | creator or in a manageable project | — |
| Team member visible | all (`members.view`) | all | self only |
| Team member editable | all | USER-role accounts | — |

## Guard rails (enforced in services, covered by tests)

* Nobody can change their own role, deactivate themselves, or issue their own reset link.
* A Super Admin's role cannot be changed in the app; nobody can be promoted *to* Super Admin in the app.
* The last active Super Admin cannot be deactivated.
* Role changes, deactivation and password resets revoke the target's sessions immediately.
* Records the user cannot see return **404** (not 403), so their existence is not revealed.
* Reports and WhatsApp summaries are built from the same scoped queries; a report can never include a task the requester cannot see.
