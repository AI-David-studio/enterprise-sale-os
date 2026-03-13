'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string
  job_title: string
  user_type: string
  organization_name: string
}

type LoadState = 'loading' | 'loaded' | 'error'

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const supabase = createClient()

  const loadProfile = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLoadState('error')
        setLoadError('Не удалось определить пользователя. Попробуйте войти заново.')
        return
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, job_title, user_type, organization_id')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        setLoadState('error')
        setLoadError('Профиль не найден. Обратитесь к администратору.')
        return
      }

      // Fetch organization name (display only, degrade gracefully on error)
      let orgName = '—'
      if (userData.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', userData.organization_id)
          .single()
        orgName = org?.name || '—'
      }

      setProfile({
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        phone: userData.phone || '',
        job_title: userData.job_title || '',
        user_type: userData.user_type,
        organization_name: orgName,
      })
      setLoadState('loaded')
    } catch {
      setLoadState('error')
      setLoadError('Произошла ошибка при загрузке профиля.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return

    setSaving(true)
    setProfileMessage(null)

    const formData = new FormData(e.currentTarget)
    const updatedFirstName = (formData.get('first_name') as string)?.trim() || ''
    const updatedLastName = (formData.get('last_name') as string)?.trim() || ''
    const updatedPhone = (formData.get('phone') as string)?.trim() || null
    const updatedJobTitle = (formData.get('job_title') as string)?.trim() || null

    const { error } = await supabase
      .from('users')
      .update({
        first_name: updatedFirstName,
        last_name: updatedLastName,
        phone: updatedPhone,
        job_title: updatedJobTitle,
      })
      .eq('id', profile.id)

    if (error) {
      setProfileMessage({ type: 'error', text: `Ошибка сохранения: ${error.message}` })
    } else {
      // Sync local state immediately
      setProfile({
        ...profile,
        first_name: updatedFirstName,
        last_name: updatedLastName,
        phone: updatedPhone || '',
        job_title: updatedJobTitle || '',
      })
      setProfileMessage({ type: 'success', text: 'Изменения сохранены.' })
    }

    setSaving(false)
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMessage(null)

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Пароль должен содержать минимум 8 символов.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Пароли не совпадают.' })
      return
    }

    setChangingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordMessage({ type: 'error', text: `Ошибка смены пароля: ${error.message}` })
    } else {
      setPasswordMessage({ type: 'success', text: 'Пароль успешно изменён.' })
      setNewPassword('')
      setConfirmPassword('')
    }

    setChangingPassword(false)
  }

  const userTypeLabel = (type: string) => {
    switch (type) {
      case 'seller': return 'Продавец'
      default: return type
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-gray-500">Загрузка профиля…</p>
      </div>
    )
  }

  if (loadState === 'error' || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <p className="text-red-500 mb-4">{loadError || 'Не удалось загрузить профиль.'}</p>
        <button
          onClick={loadProfile}
          className="text-blue-600 hover:underline text-sm"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-8">Мой профиль</h1>

      {/* Personal Data Section */}
      <section className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Личные данные</h2>

        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_first_name">
                Имя
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                id="profile_first_name"
                name="first_name"
                type="text"
                key={`fn-${profile.first_name}`}
                defaultValue={profile.first_name}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_last_name">
                Фамилия
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                id="profile_last_name"
                name="last_name"
                type="text"
                key={`ln-${profile.last_name}`}
                defaultValue={profile.last_name}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_email">
              Электронная почта
            </label>
            <input
              className="w-full rounded-md border px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
              id="profile_email"
              type="email"
              value={profile.email}
              disabled
              aria-label="Электронная почта"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_phone">
                Телефон
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                id="profile_phone"
                name="phone"
                type="tel"
                key={`ph-${profile.phone}`}
                defaultValue={profile.phone}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_job_title">
                Должность
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                id="profile_job_title"
                name="job_title"
                type="text"
                key={`jt-${profile.job_title}`}
                defaultValue={profile.job_title}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="profile_org">
                Компания
              </label>
              <input
                className="w-full rounded-md border px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                id="profile_org"
                type="text"
                value={profile.organization_name}
                disabled
                aria-label="Компания"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип участника
              </label>
              <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {userTypeLabel(profile.user_type)}
              </span>
            </div>
          </div>

          {profileMessage && (
            <div className={`rounded-md px-4 py-3 text-sm ${
              profileMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {profileMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white rounded-md px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        </form>
      </section>

      {/* Security Section */}
      <section className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-medium mb-4">Безопасность</h2>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new_password">
              Новый пароль
            </label>
            <input
              className="w-full rounded-md border px-3 py-2"
              id="new_password"
              type="password"
              placeholder="Минимум 8 символов"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm_password">
              Подтвердите пароль
            </label>
            <input
              className="w-full rounded-md border px-3 py-2"
              id="confirm_password"
              type="password"
              placeholder="Повторите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {passwordMessage && (
            <div className={`rounded-md px-4 py-3 text-sm ${
              passwordMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword}
            className="bg-gray-800 text-white rounded-md px-4 py-2 disabled:opacity-50"
          >
            {changingPassword ? 'Смена пароля…' : 'Сменить пароль'}
          </button>
        </form>
      </section>
    </div>
  )
}
