import { useOutletContext } from 'react-router-dom'
import type { OnboardingCtx } from './types'

export const useOnboarding = () => useOutletContext<OnboardingCtx>()