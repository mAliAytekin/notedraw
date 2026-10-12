import { setLocale, useLocale } from './index'

export function LanguageSwitcher() {
  const locale = useLocale()
  return <label className="language-switcher"><span>{locale === 'tr' ? 'Dil' : 'Language'}</span>
    <select aria-label="Dil / Language" value={locale} onChange={event => setLocale(event.target.value === 'en' ? 'en' : 'tr')}>
      <option value="tr">Türkçe</option><option value="en">English</option>
    </select>
  </label>
}
