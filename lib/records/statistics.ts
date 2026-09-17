import { getAllAnimals } from "@/lib/animals/animal-store";
import { listAllApplications } from "@/lib/applications/store";

// FR-REC-01 "导出...adoption statistics" - simple shelter-wide counts
// computed live from existing records, not a separate persisted entity.
export interface AdoptionStatistic {
  metric: string;
  value: number;
}

export async function getAdoptionStatistics(): Promise<AdoptionStatistic[]> {
  const animals = await getAllAnimals();
  const applications = await listAllApplications();

  return [
    { metric: "Total animals on record", value: animals.length },
    { metric: "Currently Available For Adoption", value: animals.filter((a) => a.currentStatus === "Available For Adoption").length },
    { metric: "Currently in Application In Progress", value: animals.filter((a) => a.currentStatus === "Application In Progress").length },
    { metric: "Total adoptions finalised", value: applications.filter((a) => a.applicationStatus === "Finalised").length },
    { metric: "Total animals Rehomed", value: animals.filter((a) => a.currentStatus === "Rehomed").length },
    { metric: "Total animals Returned To Owner", value: animals.filter((a) => a.currentStatus === "ReturnedToOwner").length },
    { metric: "Total animals Archived", value: animals.filter((a) => a.currentStatus === "Archived").length },
    { metric: "Total applications submitted", value: applications.filter((a) => a.applicationStatus !== "Draft").length },
    { metric: "Total applications rejected", value: applications.filter((a) => a.applicationStatus === "Rejected").length },
  ];
}
