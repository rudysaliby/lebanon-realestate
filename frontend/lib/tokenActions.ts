// Token deduction helper — call this from any component that spends tokens

export type DeductResult = {
  success: boolean
  newBalance?: number
  deducted?: number
  error?: string
  currentBalance?: number
  required?: number
}

export async function deductTokens(
  userId: string,
  amount: number,
  feature: string
): Promise<DeductResult> {
  try {
    const res = await fetch('/api/tokens/deduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, feature }),
    })
    const data = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Failed to deduct tokens',
        currentBalance: data.currentBalance,
        required: data.required,
      }
    }

    return {
      success: true,
      newBalance: data.newBalance,
      deducted: data.deducted,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' }
  }
}

// Admin: add/set/remove tokens for a user
export async function adminUpdateTokens(
  adminUserId: string,
  targetUserId: string,
  amount: number,
  action: 'add' | 'set' | 'remove' = 'add'
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const res = await fetch('/api/admin/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId, targetUserId, amount, action }),
    })
    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update tokens' }
    }

    return { success: true, newBalance: data.newBalance }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' }
  }
}
