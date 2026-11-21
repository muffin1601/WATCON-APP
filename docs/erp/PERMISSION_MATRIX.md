# Permission matrix (defaults)

Source of truth: `src/lib/permissions/definitions.ts`. Roles: A = Admin, PM = Project Manager, SE = Site Engineer,
PU = Purchase, SK = Storekeeper, AC = Accounts, VW = Viewer, U = User. **Super Admin always passes every check.**
Defaults can be changed in Settings -> Roles, except the Super Admin-only rules below.

| Area | Permission | Default roles |
|---|---|---|
| Projects | `projects.view_all` / `create` / `edit` / `archive` / `post_status` | VW,AC,PU / A / A,PM / A / A,PM |
| Sales & contracts | `so.view` | A,PM,SK,AC,VW |
| | `so.manage` (create, edit, submit, **request amendment**) | A,PM |
| | `so.approve` (approve, cancel, close a new SO) | A |
| | `cpo.view` / `cpo.manage` / `cpo.approve` | A,PM,AC,VW / A,PM / A |
| Billing | `rabill.view` / `manage` / `approve` / `certify` | A,PM,SE,AC,VW / A,PM,SE / A,PM / A,PM,AC |
| | `invoice.view` / `manage` / `approve` | A,PM,AC,VW / A,AC / A,AC |
| Planning & procurement | `mrp.view` / `manage` | A,PM,SE,PU,SK,AC,VW / A,PM,SE |
| | `pr.view` / `create` / `approve` | all ops / A,PM,SE,PU,SK / A,PM |
| | `rfq.view` / `manage` / `approve` | A,PM,PU,AC,VW / A,PU / A,PM |
| | `po.view` / `create` / `approve` / `cancel` | all ops / A,PU / A / A |
| Stores & site | `grn.view` / `create` / `post` / `reverse` | all ops / A,PM,SE,SK / A,SK,PM / A |
| | `stock.reserve` / `transfer` / `consume` | A,PM,SK / A,SK / A,PM,SE,SK |
| Accounts | `bills.view` / `manage` / `approve` | A,PU,AC,VW,PM / A,AC / A |
| | `payments.view` / `manage`, `accounts.view` | A,AC,VW,PM / A,AC / A,AC,VW,PM |
| Documents | `attachments.verify`, `approvals.view` | A,PM,SK,AC / A,PM,AC,PU,SK |
| Administration | `settings.*`, `audit.view`, `stock.adjust`, `bills.override_match` | Super Admin only |

## Sales order lock and amendment rule

| Action | Who |
|---|---|
| Create / edit a DRAFT sales order, submit it | `so.manage` |
| Approve a submitted SO | `so.approve` (not the creator / submitter when segregation is on) |
| Edit an approved SO directly | nobody - it is locked |
| Raise an amendment request on an approved SO | `so.manage`; needs a reason and the full proposed content |
| Approve or reject an amendment request | **Super Admin only**, never their own request |
| See pending amendment requests | Super Admin: all in the organisation; others: only the ones they raised ("Waiting for Super Admin") |

Data: model `SoAmendmentRequest` (`so_amendment_requests`), unique `(soId, requestNo)`, status PENDING / APPROVED / REJECTED,
`beforeSnapshot` and `proposed` stored as JSON, `appliedRevision` set when applied. Project-scope rules still apply to
non-"view all" users. The approvals inbox and project hub read it via `listSoAmendmentRequests`
(`src/modules/insights/approvals.ts`).
