import { z } from 'zod';

const CONSUMER_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'hotmail.com', 'hotmail.fr',
  'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'icloud.com', 'me.com',
  'gmx.com', 'gmx.fr', 'proton.me', 'protonmail.com', 'aol.com', 'free.fr',
  'orange.fr', 'laposte.net', 'msn.com', 'ymail.com'
];

const NOVELTY_TYPES = [
  'Launch', 'Update', 'Demo', 'Special_Offer', 'Partnership', 'Innovation'
] as const;

const isValidImageFile = (file: File) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  return validTypes.includes(file.type) && file.size <= maxSize;
};

const isValidPdfFile = (file: File) => {
  const maxSize = 20 * 1024 * 1024; // 20MB
  return file.type === 'application/pdf' && file.size <= maxSize;
};

const isProfessionalEmail = (email: string) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain && !CONSUMER_EMAIL_DOMAINS.includes(domain);
};

// Step 1: Exhibitor and User Info
export const step1Schema = z.object({
  // Exhibitor selection (either existing or new)
  exhibitor: z.union([
    // Existing exhibitor
    z.object({
      id: z.string().min(1, 'Sélectionnez un exposant'),
      name: z.string(),
      website: z.string().optional(),
      approved: z.boolean(),
    }),
    // New exhibitor
    z.object({
      name: z.string().min(1, 'Nom de l\'entreprise requis'),
      website: z.string().url('URL invalide').optional().or(z.literal('')),
      stand_info: z.string().optional(),
      logo: z.instanceof(File).optional(),
    }),
  ]),
  
  // User info (required if not logged in or incomplete profile)
  user: z.object({
    first_name: z.string().min(1, 'Prénom requis'),
    last_name: z.string().min(1, 'Nom requis'),
    email: z.string()
      .email('Email invalide')
      .refine(isProfessionalEmail, 'Utilisez votre email professionnel d\'entreprise'),
    phone: z.string().min(1, 'Téléphone requis'),
    role: z.string().min(1, 'Rôle requis'),
  }).optional(), // Optional if user is already logged in
});

// Step 2: Novelty Details
export const step2Schema = z.object({
  title: z.string()
    .min(3, 'Titre requis (min 3 caractères)')
    .max(120, 'Titre trop long (max 120 caractères)'),
  
  type: z.enum(NOVELTY_TYPES).refine(
    (value) => NOVELTY_TYPES.includes(value),
    'Type de nouveauté requis'
  ),
  
  reason: z.string()
    .min(10, 'Expliquez pourquoi c\'est intéressant (min 10 caractères)')
    .max(500, 'Description trop longue (max 500 caractères)'),
  
  images: z.array(z.union([z.instanceof(File), z.string()]))
    .max(3, 'Maximum 3 images autorisées')
    .refine(
      (files) => files.filter(f => f instanceof File).every(isValidImageFile),
      'Images invalides (JPG/PNG/WEBP, max 5MB chacune)'
    ),
  
  brochure: z.instanceof(File)
    .refine(isValidPdfFile, 'Fichier PDF invalide (max 20MB)')
    .optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;

export { NOVELTY_TYPES, CONSUMER_EMAIL_DOMAINS };
