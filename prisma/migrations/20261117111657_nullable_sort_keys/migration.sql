-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "department_sort_key" DROP NOT NULL,
ALTER COLUMN "department_sort_key" DROP DEFAULT,
ALTER COLUMN "assignee_sort_key" DROP NOT NULL,
ALTER COLUMN "assignee_sort_key" DROP DEFAULT;
