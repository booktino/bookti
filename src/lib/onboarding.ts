export function onboardingStorageKey(salonId: string) {
  return `onboarding_completed_${salonId}`;
}

export function onboardingResumeKey(salonId: string) {
  return `onboarding_resume_${salonId}`;
}

export function isOnboardingCompleted(salonId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(onboardingStorageKey(salonId)) === "true";
}

export function markOnboardingCompleted(salonId: string) {
  localStorage.setItem(onboardingStorageKey(salonId), "true");
}

export function clearOnboardingCompleted(salonId: string) {
  localStorage.removeItem(onboardingStorageKey(salonId));
}

export function setOnboardingResume(salonId: string) {
  sessionStorage.setItem(onboardingResumeKey(salonId), "1");
}

export function consumeOnboardingResume(salonId: string): boolean {
  if (typeof window === "undefined") return false;
  const key = onboardingResumeKey(salonId);
  const shouldResume = sessionStorage.getItem(key) === "1";
  if (shouldResume) sessionStorage.removeItem(key);
  return shouldResume;
}
