import type { Species } from "@/lib/animals/types";

// PRD section 12.3 Breed Seed Data: at least 10 Breed/Type options per
// Species, each with species, name, description and isRetired - a
// prototype stand-in for the future System Administration-managed
// DropdownOption (category = "Breed") until FR-SA-01 is built.
export interface BreedOption {
  species: Species;
  name: string;
  description: string;
  isRetired: boolean;
}

export const BREED_OPTIONS: BreedOption[] = [
  // Cat
  { species: "Cat", name: "Maine Coon", description: "A large, friendly breed known for its long fur and tufted ears.", isRetired: false },
  { species: "Cat", name: "Siamese", description: "A vocal, social breed with striking blue eyes.", isRetired: false },
  { species: "Cat", name: "Ragdoll", description: "A large, docile breed known for going limp when picked up.", isRetired: false },
  { species: "Cat", name: "British Shorthair", description: "A calm, easy-going breed with a dense coat.", isRetired: false },
  { species: "Cat", name: "Persian", description: "A long-haired breed known for its calm temperament and flat face.", isRetired: false },
  { species: "Cat", name: "Bengal", description: "An active, athletic breed with a wild-looking spotted coat.", isRetired: false },
  { species: "Cat", name: "Sphynx", description: "A hairless breed known for its affectionate, energetic personality.", isRetired: false },
  { species: "Cat", name: "Burmese", description: "A muscular, people-oriented breed with a glossy short coat.", isRetired: false },
  { species: "Cat", name: "Russian Blue", description: "A reserved, gentle breed with a dense silvery-blue coat.", isRetired: false },
  { species: "Cat", name: "Abyssinian", description: "An active, inquisitive breed with a ticked short coat.", isRetired: false },

  // Dog
  { species: "Dog", name: "Labrador Retriever", description: "A friendly, outgoing and high-energy working breed.", isRetired: false },
  { species: "Dog", name: "Golden Retriever", description: "A friendly, intelligent and devoted sporting breed.", isRetired: false },
  { species: "Dog", name: "German Shepherd", description: "A confident, courageous and versatile working breed.", isRetired: false },
  { species: "Dog", name: "Border Collie", description: "A highly intelligent and energetic herding breed.", isRetired: false },
  { species: "Dog", name: "Beagle", description: "A curious, friendly scent hound with a strong sense of smell.", isRetired: false },
  { species: "Dog", name: "Poodle", description: "An intelligent, active breed known for its curly, low-shedding coat.", isRetired: false },
  { species: "Dog", name: "French Bulldog", description: "A compact, affectionate breed with a playful temperament.", isRetired: false },
  { species: "Dog", name: "Staffordshire Bull Terrier", description: "A loyal, muscular breed that is affectionate with people.", isRetired: false },
  { species: "Dog", name: "Cavalier King Charles Spaniel", description: "A gentle, affectionate toy breed that enjoys companionship.", isRetired: false },
  { species: "Dog", name: "Australian Cattle Dog", description: "A hardy, intelligent herding breed with high energy needs.", isRetired: false },

  // Bird
  { species: "Bird", name: "Budgerigar", description: "A small, social parakeet known for mimicking sounds.", isRetired: false },
  { species: "Bird", name: "Cockatiel", description: "A small, affectionate parrot known for whistling and mimicry.", isRetired: false },
  { species: "Bird", name: "Lovebird", description: "A small, energetic parrot that bonds closely with a mate or owner.", isRetired: false },
  { species: "Bird", name: "Canary", description: "A small songbird bred primarily for its singing ability.", isRetired: false },
  { species: "Bird", name: "Zebra Finch", description: "A small, hardy finch known for its social, chattering nature.", isRetired: false },
  { species: "Bird", name: "African Grey Parrot", description: "A highly intelligent parrot known for advanced vocal mimicry.", isRetired: false },
  { species: "Bird", name: "Eclectus Parrot", description: "A large parrot with striking sexually dimorphic plumage.", isRetired: false },
  { species: "Bird", name: "Indian Ringneck", description: "A slender parakeet known for its long tail and vocal ability.", isRetired: false },
  { species: "Bird", name: "Sulphur-crested Cockatoo", description: "A large, vocal cockatoo with a distinctive yellow crest.", isRetired: false },
  { species: "Bird", name: "Rainbow Lorikeet", description: "A brightly coloured, nectar-feeding parrot native to Australia.", isRetired: false },

  // Reptile
  { species: "Reptile", name: "Bearded Dragon", description: "A docile reptile that adapts well to handling.", isRetired: false },
  { species: "Reptile", name: "Blue-tongued Skink", description: "A calm, ground-dwelling lizard named for its blue tongue.", isRetired: false },
  { species: "Reptile", name: "Leopard Gecko", description: "A small, docile gecko with a spotted pattern and no toe pads.", isRetired: false },
  { species: "Reptile", name: "Crested Gecko", description: "A small arboreal gecko known for its crest and adhesive toes.", isRetired: false },
  { species: "Reptile", name: "Corn Snake", description: "A docile, easy-to-handle snake popular with first-time keepers.", isRetired: false },
  { species: "Reptile", name: "Children's Python", description: "A small, calm python species native to northern Australia.", isRetired: false },
  { species: "Reptile", name: "Eastern Long-necked Turtle", description: "A freshwater turtle known for its extended neck.", isRetired: false },
  { species: "Reptile", name: "Murray River Turtle", description: "A freshwater turtle native to the Murray-Darling river system.", isRetired: false },
  { species: "Reptile", name: "Centralian Carpet Python", description: "A medium-sized python adapted to arid central Australia.", isRetired: false },
  { species: "Reptile", name: "Ackie Monitor", description: "A small, active monitor lizard suited to captivity.", isRetired: false },
];

export const BREED_SPECIES_LIST: Species[] = Array.from(
  new Set(BREED_OPTIONS.map((option) => option.species)),
);

export function getBreedsForSpecies(species: Species): BreedOption[] {
  return BREED_OPTIONS.filter((option) => option.species === species && !option.isRetired);
}
