import type { DropdownCategory, DropdownOption } from "@/lib/system-administration/types";
import type { Species } from "@/lib/animals/types";

interface SeedEntry {
  category: DropdownCategory;
  value: string;
  description: string;
  speciesId?: Species;
  systemLocked?: boolean;
}

const SEED_ENTRIES: SeedEntry[] = [
  // Title
  { category: "Title", value: "Mr", description: "Formal title for a man." },
  { category: "Title", value: "Mrs", description: "Formal title for a married woman." },
  { category: "Title", value: "Ms", description: "Formal title for a woman, marital status unspecified." },
  { category: "Title", value: "Mx", description: "Gender-neutral formal title." },
  { category: "Title", value: "Dr", description: "Used for veterinarians or persons holding a doctorate." },

  // User Role - only Administrator is explicitly systemLocked per PRD 6.3.
  { category: "User Role", value: "Administrator", description: "Full Shelter Staff Member permissions plus system administration.", systemLocked: true },
  { category: "User Role", value: "Shelter Staff Member", description: "Handles intake, assessments, adoptions and follow-up." },
  { category: "User Role", value: "Veterinarian", description: "Handles medical checks, treatment, vaccination and clearance." },
  { category: "User Role", value: "Council Animal Control Officer", description: "Submits council transfers and views own submissions." },
  { category: "User Role", value: "Adopter", description: "Public account role for browsing and adopting animals." },

  // Species - structural to the Animal record throughout the app.
  { category: "Species", value: "Cat", description: "Domestic cat.", systemLocked: true },
  { category: "Species", value: "Dog", description: "Domestic dog.", systemLocked: true },
  { category: "Species", value: "Bird", description: "Companion bird.", systemLocked: true },
  { category: "Species", value: "Reptile", description: "Reptile, including lizards, snakes and turtles.", systemLocked: true },

  // Breed and Description - PRD 12.3 (10 per species).
  { category: "Breed and Description", value: "Maine Coon", description: "A large, friendly breed known for its long fur and tufted ears.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Siamese", description: "A vocal, social breed with striking blue eyes.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Ragdoll", description: "A large, docile breed known for going limp when picked up.", speciesId: "Cat" },
  { category: "Breed and Description", value: "British Shorthair", description: "A calm, easy-going breed with a dense coat.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Persian", description: "A long-haired breed known for its calm temperament and flat face.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Bengal", description: "An active, athletic breed with a wild-looking spotted coat.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Sphynx", description: "A hairless breed known for its affectionate, energetic personality.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Burmese", description: "A muscular, people-oriented breed with a glossy short coat.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Russian Blue", description: "A reserved, gentle breed with a dense silvery-blue coat.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Abyssinian", description: "An active, inquisitive breed with a ticked short coat.", speciesId: "Cat" },
  { category: "Breed and Description", value: "Labrador Retriever", description: "A friendly, outgoing and high-energy working breed.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Golden Retriever", description: "A friendly, intelligent and devoted sporting breed.", speciesId: "Dog" },
  { category: "Breed and Description", value: "German Shepherd", description: "A confident, courageous and versatile working breed.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Border Collie", description: "A highly intelligent and energetic herding breed.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Beagle", description: "A curious, friendly scent hound with a strong sense of smell.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Poodle", description: "An intelligent, active breed known for its curly, low-shedding coat.", speciesId: "Dog" },
  { category: "Breed and Description", value: "French Bulldog", description: "A compact, affectionate breed with a playful temperament.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Staffordshire Bull Terrier", description: "A loyal, muscular breed that is affectionate with people.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Cavalier King Charles Spaniel", description: "A gentle, affectionate toy breed that enjoys companionship.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Australian Cattle Dog", description: "A hardy, intelligent herding breed with high energy needs.", speciesId: "Dog" },
  { category: "Breed and Description", value: "Budgerigar", description: "A small, social parakeet known for mimicking sounds.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Cockatiel", description: "A small, affectionate parrot known for whistling and mimicry.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Lovebird", description: "A small, energetic parrot that bonds closely with a mate or owner.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Canary", description: "A small songbird bred primarily for its singing ability.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Zebra Finch", description: "A small, hardy finch known for its social, chattering nature.", speciesId: "Bird" },
  { category: "Breed and Description", value: "African Grey Parrot", description: "A highly intelligent parrot known for advanced vocal mimicry.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Eclectus Parrot", description: "A large parrot with striking sexually dimorphic plumage.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Indian Ringneck", description: "A slender parakeet known for its long tail and vocal ability.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Sulphur-crested Cockatoo", description: "A large, vocal cockatoo with a distinctive yellow crest.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Rainbow Lorikeet", description: "A brightly coloured, nectar-feeding parrot native to Australia.", speciesId: "Bird" },
  { category: "Breed and Description", value: "Bearded Dragon", description: "A docile reptile that adapts well to handling.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Blue-tongued Skink", description: "A calm, ground-dwelling lizard named for its blue tongue.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Leopard Gecko", description: "A small, docile gecko with a spotted pattern and no toe pads.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Crested Gecko", description: "A small arboreal gecko known for its crest and adhesive toes.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Corn Snake", description: "A docile, easy-to-handle snake popular with first-time keepers.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Children's Python", description: "A small, calm python species native to northern Australia.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Eastern Long-necked Turtle", description: "A freshwater turtle known for its extended neck.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Murray River Turtle", description: "A freshwater turtle native to the Murray-Darling river system.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Centralian Carpet Python", description: "A medium-sized python adapted to arid central Australia.", speciesId: "Reptile" },
  { category: "Breed and Description", value: "Ackie Monitor", description: "A small, active monitor lizard suited to captivity.", speciesId: "Reptile" },

  // Medication
  { category: "Medication", value: "Amoxicillin", description: "Broad-spectrum antibiotic." },
  { category: "Medication", value: "Metacam (Meloxicam)", description: "Anti-inflammatory for pain relief." },
  { category: "Medication", value: "Apoquel (Oclacitinib)", description: "Treats allergic itching in dogs." },
  { category: "Medication", value: "Frontline Plus", description: "Topical flea and tick treatment." },
  { category: "Medication", value: "Revolution", description: "Topical parasite prevention treatment." },
  { category: "Medication", value: "Prednisolone", description: "Corticosteroid for inflammation and allergies." },
  { category: "Medication", value: "Doxycycline", description: "Antibiotic used for a range of infections." },
  { category: "Medication", value: "Tramadol", description: "Pain relief medication." },
  { category: "Medication", value: "Cerenia (Maropitant)", description: "Anti-nausea and vomiting treatment." },
  { category: "Medication", value: "Caninsulin", description: "Insulin used to manage diabetes." },

  // Temperament - PRD 12.4, exactly 20 values.
  { category: "Temperament", value: "Calm", description: "Settled and relaxed disposition." },
  { category: "Temperament", value: "Friendly", description: "Warm and sociable with people." },
  { category: "Temperament", value: "Affectionate", description: "Enjoys physical closeness and attention." },
  { category: "Temperament", value: "Playful", description: "Enjoys games and activity." },
  { category: "Temperament", value: "Energetic", description: "High activity level." },
  { category: "Temperament", value: "Gentle", description: "Soft and careful in interactions." },
  { category: "Temperament", value: "Curious", description: "Inquisitive about surroundings." },
  { category: "Temperament", value: "Independent", description: "Comfortable spending time alone." },
  { category: "Temperament", value: "Shy", description: "Reserved around new people or situations." },
  { category: "Temperament", value: "Timid", description: "Easily startled or nervous." },
  { category: "Temperament", value: "Confident", description: "Self-assured in new situations." },
  { category: "Temperament", value: "Social", description: "Seeks out company of people or other animals." },
  { category: "Temperament", value: "Reserved", description: "Cautious rather than outgoing." },
  { category: "Temperament", value: "Vocal", description: "Communicates frequently through sound." },
  { category: "Temperament", value: "Quiet", description: "Calm and rarely vocal." },
  { category: "Temperament", value: "Protective", description: "Watchful over family or territory." },
  { category: "Temperament", value: "Patient", description: "Tolerant during handling or waiting." },
  { category: "Temperament", value: "Alert", description: "Attentive to surroundings." },
  { category: "Temperament", value: "Trainable", description: "Responds well to training." },
  { category: "Temperament", value: "Reactive", description: "Quick, strong response to stimuli; needs careful handling." },

  // Sex - structural to Animal.sex throughout the app.
  { category: "Sex", value: "Male", description: "Male animal.", systemLocked: true },
  { category: "Sex", value: "Female", description: "Female animal.", systemLocked: true },

  // Intake Source
  { category: "Intake Source", value: "Owner Surrender", description: "Surrendered directly by the owner." },
  { category: "Intake Source", value: "Stray Found", description: "Found as a stray with no known owner." },
  { category: "Intake Source", value: "Council Transfer", description: "Transferred from a Council Animal Control submission." },
  { category: "Intake Source", value: "Born in Care", description: "Born while the parent was already in shelter care." },

  // Application Status - structural to AdoptionApplication.applicationStatus.
  { category: "Application Status", value: "Draft", description: "Not yet submitted by the Adopter.", systemLocked: true },
  { category: "Application Status", value: "Submitted", description: "Submitted and awaiting review.", systemLocked: true },
  { category: "Application Status", value: "Under Review", description: "Suitability checks in progress.", systemLocked: true },
  { category: "Application Status", value: "On Hold", description: "Held while another application for the same animal is decided.", systemLocked: true },
  { category: "Application Status", value: "Approved", description: "All suitability checks passed.", systemLocked: true },
  { category: "Application Status", value: "Rejected", description: "Application declined, with a reason recorded.", systemLocked: true },
  { category: "Application Status", value: "Finalised", description: "Agreement signed, payment cleared and record finalised.", systemLocked: true },

  // Check Type and Outcome - structural to SuitabilityCheck.
  { category: "Check Type and Outcome", value: "Reference Check", description: "Verifies the referee's account of the applicant.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Home Suitability Check", description: "Assesses the applicant's home environment.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Pet Compatibility Check", description: "Assesses compatibility with existing pets or household.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Pending", description: "Check not yet completed.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Pass", description: "Check completed with no concerns.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Concern", description: "Check raised a concern requiring judgement.", systemLocked: true },
  { category: "Check Type and Outcome", value: "Fail", description: "Check failed.", systemLocked: true },

  // Payment Method
  { category: "Payment Method", value: "Credit Card", description: "Paid by credit card." },
  { category: "Payment Method", value: "Debit Card", description: "Paid by debit card." },
  { category: "Payment Method", value: "Bank Transfer", description: "Paid by direct bank transfer." },
  { category: "Payment Method", value: "Cash", description: "Paid in cash at the shelter." },
  { category: "Payment Method", value: "EFTPOS", description: "Paid via in-person EFTPOS terminal." },

  // Follow Up Type - PRD 6.14, exactly 2 values, structural to FollowUpVisit.
  { category: "Follow Up Type", value: "Phone Call", description: "Follow-up conducted by phone.", systemLocked: true },
  { category: "Follow Up Type", value: "Home Visit", description: "Follow-up conducted in person at the adopter's home.", systemLocked: true },

  // Document Type
  { category: "Document Type", value: "Seizure Notice", description: "Council notice recording a seizure." },
  { category: "Document Type", value: "Complaint History", description: "Record of prior complaints about the animal." },
  { category: "Document Type", value: "Found Animal Report", description: "Report describing where and how the animal was found." },
  { category: "Document Type", value: "Landlord Permission Letter", description: "Proof of a landlord's permission to keep pets." },
  { category: "Document Type", value: "Other Council Paperwork", description: "Any other supporting council document." },
];

const SEED_TIMESTAMP = "2024-01-08T09:00:00.000Z";

export function buildSeedOptions(): DropdownOption[] {
  return SEED_ENTRIES.map((entry) => ({
    id: `${entry.category}:${entry.value}`,
    category: entry.category,
    value: entry.value,
    description: entry.description,
    speciesId: entry.speciesId,
    isRetired: false,
    systemLocked: entry.systemLocked ?? false,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));
}
