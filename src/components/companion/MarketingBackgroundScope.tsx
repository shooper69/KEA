import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  isMarketingPath,
  MARKETING_BACKGROUND_EVENT,
  readMarketingBackground,
} from '../../data/keaMarketingBackground'

/** Applies the admin marketing background on home, Method, What is Kea, and their login/register overlay. */
export function MarketingBackgroundScope() {
  const { pathname } = useLocation()

  useEffect(() => {
    const marketing = isMarketingPath(pathname)
    function apply() {
      const black = marketing && readMarketingBackground() === 'black'
      document.documentElement.classList.toggle('kea-marketing-black', black)
    }
    apply()
    window.addEventListener(MARKETING_BACKGROUND_EVENT, apply)
    return () => {
      window.removeEventListener(MARKETING_BACKGROUND_EVENT, apply)
      document.documentElement.classList.remove('kea-marketing-black')
    }
  }, [pathname])

  return null
}
