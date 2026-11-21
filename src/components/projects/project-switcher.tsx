"use client";

import { useRouter } from "next/navigation";
import { SingleSelect } from "@/components/forms/combobox";

/** Jump to another project, staying on the same workspace tab. */
export function ProjectSwitcher({ projects, currentId, tab }: { projects: { id: string; code: string; name: string }[]; currentId: string; tab: string }) {
  const router = useRouter();
  if (projects.length < 2) return null;
  return (
    <div className="w-full sm:w-64">
      <label htmlFor="project-switcher" className="sr-only">
        Switch project
      </label>
      <SingleSelect
        id="project-switcher"
        options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.code }))}
        value={currentId}
        allowClear={false}
        searchPlaceholder="Find a project…"
        onChange={(id) => {
          if (id && id !== currentId) router.push(tab === "overview" ? `/projects/${id}` : `/projects/${id}?tab=${tab}`);
        }}
      />
    </div>
  );
}
