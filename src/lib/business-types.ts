const BUSINESS_TYPE_ICONS: Record<string, string> = {
  "Frisør / Barber": "✂️",
  "Skjønnhetssalong": "💆",
  "Massasje / Spa": "🧖",
  "Personlig trener": "🏋️",
  "Fysioterapi / Naprapat": "🦴",
  "Tannlege": "🦷",
  "Tatovering / Piercing": "🎨",
  "Annet": "📋",
};

export function getServiceIcon(businessType: string | null | undefined): string {
  return BUSINESS_TYPE_ICONS[businessType ?? ""] ?? "📋";
}
