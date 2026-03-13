import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getUserDealRole } from '@/utils/roles'
import { InviteSection } from './invite-section'
import { DealSettingsForm } from './deal-settings-form'

export default async function DealPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Find user's organization to load its active deal
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, description, target_industry')
    .eq('organization_id', profile?.organization_id)
    .limit(1)

  const activeDeal = deals?.[0]

  // Resolve user role for mutation authority check
  let isLeadAdvisor = false
  if (activeDeal?.id) {
    try {
      const role = await getUserDealRole(user.id, activeDeal.id)
      isLeadAdvisor = role === 'lead_advisor'
    } catch {
      // Role check failed — disable editing safely
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Настройки Сделки</h1>
        <p className="text-gray-500">
          Здесь вы можете настроить параметры вашей активной сделки. Система поддерживает только одну активную операционную сделку.
        </p>
      </div>

      {activeDeal ? (
        <DealSettingsForm
          deal={activeDeal}
          canEdit={isLeadAdvisor}
        />
      ) : (
        <div className="bg-white p-12 text-center text-gray-500 rounded-lg border shadow-sm">
          Активная сделка не найдена.
        </div>
      )}

      {/* Invite section — visible only to lead_advisor */}
      {isLeadAdvisor && activeDeal?.id && (
        <InviteSection dealId={activeDeal.id} />
      )}
    </div>
  )
}
