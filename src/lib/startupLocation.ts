import type { CustomLocation } from './types';
import type { LocationMode } from './types';

export type AutoLocationFailureDecision =
  | { type: 'open-map'; mode: LocationMode }
  | { type: 'use-custom'; location: CustomLocation };

export function decideAutoLocationFailure(customLocation: CustomLocation | null): AutoLocationFailureDecision {
  if (customLocation) {
    return { type: 'use-custom', location: customLocation };
  }

  return { type: 'open-map', mode: 'custom' };
}
