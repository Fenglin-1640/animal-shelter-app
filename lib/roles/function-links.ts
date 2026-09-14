// Maps a Landing Screen / RoleSidebar function label (PRD 5.2) to its
// route, once that screen is built. Labels missing here stay inert.
export const FUNCTION_HREFS: Partial<Record<string, string>> = {
  "User Administration": "/user-administration",
  "System Administration": "/system-administration",
  Animals: "/animals",
  "Adoption Listings": "/adoption-listings",
  "My Adopter Profile": "/my-adopter-profile",
  "My Applications": "/my-applications",
  "My Meet and Greets": "/my-meet-and-greets",
  "My Agreements": "/my-agreements",
};
